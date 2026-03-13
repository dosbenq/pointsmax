# Agent Contribution Contract

## Task Contract (Required)

All AI agents (Codex, Kimi, Gemini) must define their scope before touching code.
1. Declare exactly which files will be modified.
2. State the Acceptance Criteria.
3. List the tests that will be updated/added.

## Output Format (Required)

1. No "any" types unless a waiver is explicitly granted.
2. Ensure clean architecture boundaries are not broken.
3. Update relevant documentation if the feature requires it.

## Review Handoff

When the agent task is finished, it should:
1. Run local checks (lint, test, build).
2. Report the results.
3. Explain if any tests fail and why.