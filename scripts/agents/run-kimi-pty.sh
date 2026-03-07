#!/bin/zsh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: run-kimi-pty.sh <prompt-file>" >&2
  exit 2
fi

PROMPT_FILE="$1"
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt file not found: $PROMPT_FILE" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCAL_SHARE_DIR="${REPO_ROOT}/.agent-state/kimi"
SOURCE_SHARE_DIR="${HOME}/.kimi"

mkdir -p "${LOCAL_SHARE_DIR}/logs"
export KIMI_SHARE_DIR="${LOCAL_SHARE_DIR}"
export TERM="${TERM:-xterm-256color}"

for name in config.toml config.json mcp.json device_id credentials; do
  if [[ -e "${SOURCE_SHARE_DIR}/${name}" && ! -e "${LOCAL_SHARE_DIR}/${name}" ]]; then
    cp -R "${SOURCE_SHARE_DIR}/${name}" "${LOCAL_SHARE_DIR}/${name}"
  fi
done

PROMPT="$(cat "$PROMPT_FILE")"

# Kimi expects a real terminal. Running it through `script` provides a PTY
# while keeping the existing orchestrator/task contract unchanged.
exec script -q /dev/null kimi --yolo -p "$PROMPT"
