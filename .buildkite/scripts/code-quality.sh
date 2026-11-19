#!/usr/bin/env bash
# Runs every static check on one machine (one install), keeps going after a failure,
# and lists which checks failed. Locally: SKIP_SETUP=1 .buildkite/scripts/code-quality.sh
set -uo pipefail

if [ -z "${SKIP_SETUP:-}" ]; then
  source "$(dirname "$0")/setup.sh"
  set +e
fi

failed=()

check() {
  local name="$1"
  shift
  echo "--- $name"
  if "$@"; then
    echo "passed: $name"
  else
    echo "^^^ +++"
    echo "FAILED: $name"
    failed+=("$name")
  fi
}

check "Lint (ESLint)" pnpm exec turbo run lint --filter='!@shop/etl'
check "Lint (Ruff, ETL)" pnpm --filter @shop/etl lint
check "Format (Prettier)" pnpm format:check
check "Typecheck" pnpm typecheck

if [ ${#failed[@]} -gt 0 ]; then
  echo "+++ Failed checks"
  printf ' - %s\n' "${failed[@]}"
  if command -v buildkite-agent >/dev/null 2>&1; then
    {
      echo "**Code quality failed:**"
      printf -- '- %s\n' "${failed[@]}"
    } | buildkite-agent annotate --style error --context code-quality
  fi
  exit 1
fi
echo "All code quality checks passed"
