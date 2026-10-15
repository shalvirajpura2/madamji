#!/usr/bin/env bash
# Runs the agent with a Linux virtualenv (also works from WSL on a Windows checkout).
# usage: ./dev.sh [dev|console|start|download-files|test]
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.venvs/ustaad-agent}"
cd "$(dirname "$0")"
uv sync --quiet
if [ "${1:-dev}" = "test" ]; then
  uv run pytest -q
else
  uv run python -m ustaad_agent "${@:-dev}"
fi
