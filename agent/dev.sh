#!/usr/bin/env bash
# Runs the agent with a Linux virtualenv (also works from WSL on a Windows checkout).
# usage: ./dev.sh [dev|console|start|download-files|test|evals]
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.venvs/ustaad-agent}"
cd "$(dirname "$0")"
# inside WSL, "localhost" is the linux vm, so point a local WEB_URL at the windows host
if grep -qi microsoft /proc/version 2>/dev/null && grep -q "^WEB_URL=http://localhost" .env.local 2>/dev/null; then
  host=$(ip route | awk '/default/ {print $3}')
  port=$(grep "^WEB_URL=" .env.local | sed -E 's|.*:([0-9]+).*|\1|')
  export WEB_URL="http://$host:${port:-3000}"
fi
uv sync --quiet
if [ "${1:-dev}" = "test" ]; then
  uv run pytest -q
elif [ "${1:-}" = "evals" ]; then
  uv run pytest -q evals "${@:2}"
else
  uv run python -m ustaad_agent "${@:-dev}"
fi
