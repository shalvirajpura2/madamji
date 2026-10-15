#!/usr/bin/env bash
# Deploys the agent to LiveKit Cloud. First time: `lk cloud auth` and `lk agent create`
# inside agent/, which writes livekit.toml. Secrets are set with `lk agent update-secrets`.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf content && cp -r ../content content
trap 'rm -rf content' EXIT
lk agent deploy
