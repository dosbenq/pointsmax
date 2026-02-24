#!/usr/bin/env python3
"""
Apply Supabase SQL migrations through the Management API.

Why this exists:
- Supabase CLI v2 expects timestamp migration filenames and rejects 001_*.sql.
- This runner keeps our existing numbered filenames working in automation.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


REQUIRED_TABLES = ("programs", "cards", "valuations", "users")


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(1)


def get_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        fail(f"Missing required environment variable: {name}")
    return value


def extract_rows(payload: Any, label: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if isinstance(payload, dict):
        for key in ("result", "results", "data", "rows"):
            maybe = payload.get(key)
            if isinstance(maybe, list):
                return [row for row in maybe if isinstance(row, dict)]

    fail(f"Unexpected SQL response shape in {label}: {type(payload).__name__}")
    return []


class SupabaseSqlClient:
    def __init__(self, project_ref: str, token: str) -> None:
        self.api_url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "pointsmax-migration-bot/1.0",
            # Some Supabase endpoints expect apikey-like auth in addition to bearer.
            "apikey": token,
        }

    def run_sql(self, sql: str, label: str) -> Any:
        body = json.dumps({"query": sql}).encode("utf-8")
        req = urllib.request.Request(
            self.api_url,
            data=body,
            headers=self.headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode("utf-8")
                if not raw.strip():
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 403 and "1010" in err_body:
                fail(
                    "Supabase API blocked the request (403 / Cloudflare 1010). "
                    "Check API token scope and Supabase API access policy.\n"
                    f"Step: {label}\nResponse: {err_body}"
                )
            fail(f"SQL error in {label} ({exc.code}): {err_body}")
        except urllib.error.URLError as exc:
            fail(f"Network error in {label}: {exc.reason}")


def local_migration_versions() -> list[str]:
    files = sorted(glob.glob("supabase/migrations/*.sql"))
    return [os.path.basename(path).removesuffix(".sql") for path in files]


def fetch_applied_versions(client: SupabaseSqlClient) -> set[str]:
    payload = client.run_sql(
        "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version",
        "fetch applied migrations",
    )
    rows = extract_rows(payload, "fetch applied migrations")
    applied: set[str] = set()
    for row in rows:
        version = row.get("version")
        if isinstance(version, str):
            applied.add(version)
    return applied


def check_api(client: SupabaseSqlClient) -> None:
    payload = client.run_sql("SELECT 1 AS ok", "api check")
    rows = extract_rows(payload, "api check")
    if not rows:
        fail("API check failed: empty result")
    ok_value = rows[0].get("ok")
    if ok_value not in (1, "1", True):
        fail(f"API check returned unexpected payload: {rows[0]}")
    print("Supabase SQL API reachable.")


def dry_run(client: SupabaseSqlClient) -> int:
    applied = fetch_applied_versions(client)
    local = local_migration_versions()
    pending = [v for v in local if v not in applied]
    print(f"Applied migrations in DB: {len(applied)}")
    if pending:
        print(f"Pending migrations ({len(pending)}):")
        for version in pending:
            print(f"  - {version}.sql")
    else:
        print("No pending migrations.")
    return len(pending)


def apply(client: SupabaseSqlClient, verify: bool) -> None:
    applied = fetch_applied_versions(client)
    local = local_migration_versions()
    pending = [v for v in local if v not in applied]

    print(f"Applied migrations in DB: {len(applied)}")
    if not pending:
        print("Nothing to do — all migrations already applied.")
        if verify:
            verify_schema(client)
        return

    print(f"Pending migrations ({len(pending)}): {pending}")
    for version in pending:
        path = f"supabase/migrations/{version}.sql"
        print(f"\nApplying {version} ...")
        with open(path, "r", encoding="utf-8") as handle:
            sql = handle.read()
        client.run_sql(sql, f"apply {version}")
        escaped = version.replace("'", "''")
        client.run_sql(
            f"INSERT INTO supabase_migrations.schema_migrations(version) "
            f"VALUES ('{escaped}') ON CONFLICT DO NOTHING",
            f"record {version}",
        )
        print(f"  ✓ {version}")

    print(f"\nDone — {len(pending)} migration(s) applied.")
    if verify:
        verify_schema(client)


def verify_schema(client: SupabaseSqlClient) -> None:
    payload = client.run_sql(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
        "verify schema tables",
    )
    rows = extract_rows(payload, "verify schema tables")
    tables = {row.get("tablename") for row in rows if isinstance(row.get("tablename"), str)}
    missing = [table for table in REQUIRED_TABLES if table not in tables]
    if missing:
        fail(f"FAIL — missing required tables: {missing}")
    print(f"Schema OK — found required tables: {', '.join(REQUIRED_TABLES)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Supabase migration runner via Management API")
    parser.add_argument(
        "command",
        choices=("check", "dry-run", "apply", "verify"),
        help="Operation to run",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="When used with apply, run schema verification after migration",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_ref = get_env("SUPABASE_PROJECT_REF")
    token = get_env("SUPABASE_ACCESS_TOKEN")
    client = SupabaseSqlClient(project_ref, token)

    if args.command == "check":
        check_api(client)
        return
    if args.command == "dry-run":
        dry_run(client)
        return
    if args.command == "apply":
        apply(client, verify=args.verify)
        return
    if args.command == "verify":
        verify_schema(client)
        return

    fail(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
