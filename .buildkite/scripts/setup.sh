#!/usr/bin/env bash
# Shared setup for every Buildkite check. Usage: setup.sh [node|python]
#   node   (default) enable pnpm and install the dependencies
#   python install uv only (for the ETL lint)
set -euo pipefail

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export PATH="$HOME/.local/bin:$PATH"

cp .env.example .env

if [ "${1:-node}" = "python" ]; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  exit 0
fi

corepack enable || corepack enable --install-directory "$HOME/.local/bin"
curl -LsSf https://astral.sh/uv/install.sh | sh
pnpm install --frozen-lockfile
