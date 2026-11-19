# Continuous integration

Two pipelines run the same checks: GitHub Actions (`.github/workflows/ci.yml`) and Buildkite (`.buildkite/pipeline.yml`). Both run on every pull request and on pushes to `main`.

## Checks

Every check is a separate job (GitHub Actions) or step (Buildkite), so a pull request shows one line per check. The names are the same in both pipelines.

| Check             | Command                                          | Notes                                                  |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Lint (ESLint)     | `pnpm exec turbo run lint --filter='!@shop/etl'` | TypeScript apps and packages                           |
| Lint (Ruff, ETL)  | `pnpm --filter @shop/etl lint`                   | Python ETL job; needs `uv`, not Node                   |
| Format (Prettier) | `pnpm format:check`                              | Fails if any file is not formatted; fix: `pnpm format` |
| Typecheck         | `pnpm typecheck`                                 |                                                        |
| Build             | `pnpm build`                                     |                                                        |
| Unit tests        | `pnpm test`                                      | Vitest                                                 |

Setup (Node, pnpm, `uv`, `.env` from `.env.example`, `pnpm install --frozen-lockfile`) is shared:

- GitHub Actions: composite action `.github/actions/setup`.
- Buildkite: `.buildkite/scripts/setup.sh`.

Each check runs on its own machine, so every one repeats the setup. That costs some minutes of runner time, and in return a failure points straight at the check that broke.

## Run the checks locally

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

## Requiring checks before merging

The pipelines only report results. Nothing is enforced until the repository has a branch protection rule (or ruleset) on `main` in GitHub, under Settings > Branches (or Rules):

- Require a pull request before merging (no direct pushes to `main`).
- Require status checks to pass, and select each check above for GitHub Actions: `Lint (ESLint)`, `Lint (Ruff, ETL)`, `Format (Prettier)`, `Typecheck`, `Build`, `Unit tests`.
- For Buildkite, add its checks as required too. In the Buildkite pipeline's GitHub settings, turn on the option that creates a separate GitHub commit status for each step; otherwise GitHub only sees one line for the whole build.
- Require branches to be up to date before merging.

Note: required status checks and rulesets on private repositories need a paid GitHub plan; on a free plan they are available for public repositories.

If a check is renamed, update the required checks in GitHub, because the rule matches on the name.
