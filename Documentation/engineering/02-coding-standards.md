# 02 Coding Standards

## TypeScript Strictness
- `any` is disallowed by default.
- Allowed only with explicit waiver comment on same line: `// @any-waiver: <reason>`.
- Prefer explicit return types for exported functions.
- Use discriminated unions for API and domain result states.

## Error Handling
- API routes must return structured errors using shared helpers.
- Never leak raw provider/database internals to clients.
- Log internal details with request IDs; return generic client-safe messages.

## Configuration and Environment
- No hardcoded mutable business constants in routes/pages.
- Store mutable config in:
  - `src/config/*` (typed static config), or
  - DB-backed config when runtime updates are needed.
- Access `process.env` through dedicated env/config modules whenever possible.

## External Links and URLs
- External booking/portal URLs must come from typed registries.
- Validate URL format in code and tests.
- No direct hardcoded production URLs in feature modules.

## Function and Module Design
- Keep modules small and focused.
- Favor pure functions in `domain` layer.
- Separate orchestration from rendering and from infrastructure I/O.

## Naming and Structure
- Use domain names, not implementation names.
- Keep file names consistent with exported symbol intent.
- Public feature exports only via `src/features/<feature>/index.ts`.

## Comments and Documentation
- Add comments for non-obvious constraints and tradeoffs.
- Avoid comments that restate the code.

## Security and Privacy
- Validate input sizes and schemas on all external boundaries.
- Apply rate limits and content-length checks on heavy APIs.
- Do not log secrets or full sensitive payloads.
