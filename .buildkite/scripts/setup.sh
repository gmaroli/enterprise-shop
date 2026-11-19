#!/usr/bin/env bash
# Shared setup for every Buildkite step. Source it so the PATH change reaches the caller:
#   source .buildkite/scripts/setup.sh
# Enables pnpm, installs uv (for the Python ETL lint) and the dependencies.
set -euo pipefail

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export PATH="$HOME/.local/bin:$PATH"

[ -f .env ] || cp .env.example .env

corepack enable || corepack enable --install-directory "$HOME/.local/bin"
curl -LsSf https://astral.sh/uv/install.sh | sh
pnpm install --frozen-lockfile
