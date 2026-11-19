# Continuous integration

Two pipelines define the checks: Buildkite (`.buildkite/pipeline.yml`) and GitHub Actions (`.github/workflows/ci.yml`).

**Status:** Buildkite is the active CI and runs on every pull request and on pushes to `main`. GitHub Actions is **paused** (since 2026-11-19): its workflow only runs when started by hand (Actions tab > CI > Run workflow), so it adds no checks to pull requests. To switch it back on, restore the `push` and `pull_request` triggers at the top of `ci.yml` and add its checks to the branch protection rule.

## Checks

**Buildkite (active)** reports three checks, one line each on a pull request:

| Check        | What it runs                                                                       |
| ------------ | ---------------------------------------------------------------------------------- |
| Code quality | `.buildkite/scripts/code-quality.sh`: the four static checks below, on one machine |
| Build        | `pnpm build`                                                                       |
| Unit tests   | `pnpm test` (Vitest)                                                               |

Code quality runs these in order and keeps going after a failure, then lists the failed ones in the log and as a build annotation:

| Static check      | Command                                          |
| ----------------- | ------------------------------------------------ |
| Lint (ESLint)     | `pnpm exec turbo run lint --filter='!@shop/etl'` |
| Lint (Ruff, ETL)  | `pnpm --filter @shop/etl lint`                   |
| Format (Prettier) | `pnpm format:check` (fix with `pnpm format`)     |
| Typecheck         | `pnpm typecheck`                                 |

Why grouped: they are quick and share one install, so one machine does the setup once instead of four times, and the pull request stays short. The cost is that GitHub shows only "Code quality" failed; the build log and annotation say which check.

**GitHub Actions (paused)** still has one job per check (ESLint, Ruff, Prettier, Typecheck, Build, Unit tests). If it is switched back on, consider grouping it the same way.

Setup (Node, pnpm, `uv`, `.env` from `.env.example` if missing, `pnpm install --frozen-lockfile`) is shared:

- Buildkite: `.buildkite/scripts/setup.sh`, sourced by each step.
- GitHub Actions: composite action `.github/actions/setup`.

Buildkite steps run in parallel on fresh agents, so each of the three runs the setup once.

## Run the checks locally

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test
# or the same grouped run as CI, without the install:
SKIP_SETUP=1 .buildkite/scripts/code-quality.sh
```

## Requiring checks before merging

The pipelines only report results. Nothing is enforced until the repository has a branch protection rule (or ruleset) on `main` in GitHub, under Settings > Branches (or Rules):

- Require a pull request before merging (no direct pushes to `main`).
- Require status checks to pass, and select the Buildkite statuses: `buildkite/Code quality`, `buildkite/Build`, `buildkite/Unit tests`. Each step posts its own GitHub commit status through a `notify` block in `.buildkite/pipeline.yml`; without it GitHub only sees one line (`buildkite/enterprise-shop`) for the whole build, which is also fine to leave as it is.
- Do **not** require the GitHub Actions checks (`Lint (ESLint)`, `Format (Prettier)` and so on) while that workflow is paused: they never report, so every merge would be blocked. Add them only when the workflow is switched back on.
- Require branches to be up to date before merging.

Note: required status checks and rulesets on private repositories need a paid GitHub plan; on a free plan they are available for public repositories.

If a check is renamed, update the required checks in GitHub, because the rule matches on the name.
