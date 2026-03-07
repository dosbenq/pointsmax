# Agent Runner Operations

## Purpose

The agent runner is the non-blocking execution layer for local agent CLIs. It
solves the main reliability problem in multi-agent work:

- Codex can create and manage tasks through repo files
- actual CLI execution happens in the user's normal shell environment
- long-running work is tracked through supervisor heartbeats and runner manifests

## Architecture

Control plane:

- `agents/tasks/`
- `agents/outbox/`
- `agents/runtime/prompts/`
- `agents/runtime/logs/`

Execution plane:

- `scripts/agents/runner.mjs`
- `scripts/agents/supervisor.mjs`
- `scripts/agents/orchestrator.mjs`
- wrapper scripts such as `scripts/agents/run-kimi-pty.sh`

State:

- `agents/runtime/runner/` stores runner manifests
- `agents/runtime/supervisor/` stores per-agent supervisor state and heartbeat files
- `.agent-state/kimi/` stores Kimi runtime state inside the repo

## Command Model

Start a local multi-agent runner:

```bash
cd /Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax
npm run agents:runner:start -- --owners kimi,gemini,claude --interval_ms 15000 --timeout_ms 1200000 --no_output_timeout_ms 900000 --max_blocked_retries 2
```

Check active runners:

```bash
npm run agents:runner:list
```

Inspect one runner:

```bash
npm run agents:runner:status -- RUN-...
```

Watch live progress:

```bash
npm run agents:runner:watch -- RUN-... --interval_ms 5000
```

Stop all supervisors tracked by a runner:

```bash
npm run agents:runner:stop -- RUN-...
```

## How It Works

1. Runner reads enabled owners from `agents/config/agents.json` unless `--owners` is passed.
2. For each owner, runner starts or attaches to a per-owner supervisor.
3. Each supervisor repeatedly dispatches eligible tasks.
4. `depends_on` is enforced by `orchestrator.mjs`, so downstream stories wait until upstream tasks are `done`.
5. Supervisor heartbeat files expose counts and phase.
6. Runner status aggregates those heartbeats so Codex can monitor progress without owning the execution shell.

## Failure Model

Expected failure classes:

- auth/session failure inside the local CLI
- provider/network outage
- no-output timeout
- overall timeout
- validation failure in the task itself

What the runner fixes:

- non-blocking execution
- one command to start all agents
- aggregated status
- reuse of existing retry and heartbeat machinery

What the runner does not fix:

- expired external logins
- upstream provider/network outages
- broken acceptance criteria in the task contract

## Kimi-specific Notes

Kimi is launched via `scripts/agents/run-kimi-pty.sh`.

Why:

- Kimi expects a real terminal
- direct headless execution caused termios/socket failures
- writes to `~/.kimi` can fail under sandboxed execution paths

The wrapper:

- launches Kimi through a PTY (`script`)
- sets `KIMI_SHARE_DIR=.agent-state/kimi`
- mirrors existing auth/config artifacts from `~/.kimi` into the repo-local state dir as needed

## Recommended Operating Pattern

1. Create strict story tasks with acceptance criteria and tests.
2. Start one runner for all desired owners.
3. Let Codex manage priority, review, and retries through the repo protocol.
4. Use `runner:watch` or `runner:status` instead of watching raw terminal sessions.
5. Review outbox artifacts before marking any task `done`.

## Current Card Recommender Story Backlog

The latest normalized story sequence is documented in:

- `Documentation/card-recommender-v2-story-map.md`

Current execution order:

1. `TASK-0037`
2. `TASK-0038`
3. `TASK-0039`
4. `TASK-0040`
5. `TASK-0041`
6. `TASK-0042`
7. `TASK-0043`
8. `TASK-0044`
