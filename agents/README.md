# Multi-Agent Orchestration (CLI)

This folder is the shared protocol for coordinating multiple coding LLM CLIs (Claude, Gemini, Kimi, Codex) from one repo.

## Layout

- `agents/config/agents.json`: command templates per agent
- `agents/tasks/TASK-####.md`: PM task contracts
- `agents/outbox/<agent>/...`: execution reports and raw outputs
- `agents/runtime/prompts/...`: generated prompts sent to agents
- `agents/runtime/logs/...`: reserved for future run logs

## Quick start

```bash
npm run agents:init
npm run agents:create -- --owner kimi --title "Fix pricing copy" --objective "Update free/pro table" --scope "pricing page only" --criteria "copy updated;build passes" --tests "unit test for updated component;api test updated" --checks "npm run lint;npm run test -- --run"
npm run agents:list
npm run agents:dispatch -- TASK-0001 --timeout_ms 180000 --no_output_timeout_ms 45000
npm run agents:report
npm run agents:evaluate
```

## Task lifecycle

`pending -> in_progress -> in_review -> done`

If a dispatch command fails or times out, status moves to `blocked`.

## Async queue mode (recommended)

Run agents in the background, then keep coding while they work:

```bash
npm run agents:queue:start -- --owner gemini --status pending --timeout_ms 420000 --no_output_timeout_ms 180000
npm run agents:queue:list
npm run agents:queue:status -- JOB-2026-02-27_04-40-00-000Z
npm run agents:queue:watch -- JOB-2026-02-27_04-40-00-000Z --interval_ms 5000
```

- `queue:start` launches `dispatch-all` in a detached background process.
- `queue:status` returns JSON status + task counts.
- `queue:watch` streams live status updates until the job exits.
- Queue logs are written to `agents/runtime/logs/JOB-*.log`.

## Configure your local CLI commands

Default commands are in `agents/config/agents.json`.

You can override per run via environment variables:

- `AGENT_CMD_CLAUDE`
- `AGENT_CMD_GEMINI`
- `AGENT_CMD_KIMI`
- `AGENT_CMD_CODEX`

Each command supports template variables:

- `{{prompt_file}}`
- `{{task_file}}`
- `{{task_id}}`
- `{{repo_root}}`
- `{{outbox_dir}}`

Example:

```bash
AGENT_CMD_CLAUDE='claude -p "$(cat {{prompt_file}})"' npm run agents:dispatch -- TASK-0001
```

## Agent routing mode

The orchestrator is agent-agnostic. Route tasks with `owner` metadata and keep task filenames generic.

If you need temporary single-agent mode, disable others in `agents/config/agents.json`.

## Recommended PM flow

1. Create task (`agents:create`) with strict acceptance criteria and explicit test cases.
2. Dispatch to an owner (`agents:dispatch`).
3. Review outbox report in `agents/outbox/<owner>/...`.
4. Move to `done` only after local checks pass (`lint`, `test`, `build`).

## Performance monitoring

- `npm run agents:report` writes `agents/runtime/logs/agent-performance-latest.md`
- Metrics include success rate, timeout rate, output rate, average duration, and a ranking score
- Use this report weekly to compare Gemini/Claude/Kimi/Codex on real throughput and reliability
- `npm run agents:evaluate` writes:
  - `agents/runtime/logs/agent-eval-<date>.json` (normalized run-evaluation artifact)
  - `agents/runtime/logs/agent-role-fit-latest.md` (capability matrix by task type)

## Task quality contract (required)

Every task must include:

- clear scope (`--scope`)
- measurable acceptance criteria (`--criteria`)
- required tests to add/update (`--tests`)
- validation commands (`--checks`, defaults to lint + unit tests)

This keeps agent work auditable and prevents ambiguous outcomes.

## Notes

- Dispatch runs sequentially (one task at a time) to avoid uncontrolled merge conflicts.
- Use one branch/worktree per developer/agent for parallel delivery.
