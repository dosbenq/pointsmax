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
npm run agents:create -- --owner gemini --title "Fix pricing copy" --objective "Update free/pro table" --scope "pricing page only" --criteria "copy updated;build passes"
npm run agents:list
npm run agents:dispatch -- TASK-0001
```

## Task lifecycle

`pending -> in_progress -> in_review -> done`

If a dispatch command fails or times out, status moves to `blocked`.

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

## Recommended PM flow

1. Create task (`agents:create`) with strict acceptance criteria.
2. Dispatch to an owner (`agents:dispatch`).
3. Review outbox report in `agents/outbox/<owner>/...`.
4. Move to `done` only after local checks pass (`lint`, `test`, `build`).

## Notes

- Dispatch runs sequentially (one task at a time) to avoid uncontrolled merge conflicts.
- Use one branch/worktree per developer/agent for parallel delivery.
