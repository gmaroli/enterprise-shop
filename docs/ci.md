# Continuous integration

Two pipelines define the same checks: Buildkite (`.buildkite/pipeline.yml`) and GitHub Actions (`.github/workflows/ci.yml`).

**Status:** Buildkite is the active CI and runs on every pull request and on pushes to `main`. GitHub Actions is **paused** (since 2026-11-19): its workflow only runs when started by hand (Actions tab > CI > Run workflow), so it adds no checks to pull requests. To switch it back on, restore the `push` and `pull_request` triggers at the top of `ci.yml` and add its checks to the branch protection rule.

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
- Require status checks to pass, and select the Buildkite statuses: `buildkite/Lint (ESLint)`, `buildkite/Lint (Ruff, ETL)`, `buildkite/Format (Prettier)`, `buildkite/Typecheck`, `buildkite/Build`, `buildkite/Unit tests`. Each step posts its own GitHub commit status through a `notify` block in `.buildkite/pipeline.yml`; without it GitHub only sees one line (`buildkite/enterprise-shop`) for the whole build.
- Do **not** require the GitHub Actions checks (`Lint (ESLint)`, `Format (Prettier)` and so on) while that workflow is paused: they never report, so every merge would be blocked. Add them only when the workflow is switched back on.
- Require branches to be up to date before merging.

Note: required status checks and rulesets on private repositories need a paid GitHub plan; on a free plan they are available for public repositories.

If a check is renamed, update the required checks in GitHub, because the rule matches on the name.
