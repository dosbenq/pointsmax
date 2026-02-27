# 05 Agent Contribution Contract

## Scope
Applies to all LLM contributors and human collaborators using the task orchestrator.

## Task Contract (Required)
Each task must define:
- objective
- scope
- acceptance criteria
- required test cases
- validation commands
- constraints

## Output Format (Required)
Agent run output must include:
- summary
- changed_files
- tests_added_or_updated
- commands_run_with_results
- risks

## Review Handoff
A task can move to `done` only after:
- human review confirms acceptance criteria
- local/CI checks pass
- no boundary/policy violations remain

## Allowed vs Disallowed
Allowed:
- changes inside declared scope
- required tests for changed behavior

Disallowed:
- unrelated edits
- skipping required validations
- introducing hidden hardcoded config/URLs

## Agent-Neutral Ownership
- Owner is metadata (`owner` field), not file naming.
- Task filenames remain generic (`TASK-####.md`).

## Quality-First Routing
Agent routing is based on measured quality metrics first:
- correctness
- regression rate
- rework cost
- test adequacy

Speed/cost are secondary tie-breakers.
