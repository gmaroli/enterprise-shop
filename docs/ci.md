# Continuous integration

Two pipelines define the checks: Buildkite (`.buildkite/pipeline.yml`) and GitHub Actions (`.github/workflows/ci.yml`).

**Status:** Buildkite is the active CI and runs on every pull request and on pushes to `main`. GitHub Actions is **paused** (since 2026-11-19): its workflow only runs when started by hand (Actions tab > CI > Run workflow), so it adds no checks to pull requests. To switch it back on, restore the `push` and `pull_request` triggers at the top of `ci.yml` and add its checks to the branch protection rule.

## Checks

**Buildkite (active)** reports five checks, one line each on a pull request:

| Check        | What it runs                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Code quality | `.buildkite/scripts/code-quality.sh`: the four static checks below, on one machine                                 |
| Build        | `pnpm build`                                                                                                       |
| Unit tests   | `pnpm test` (Vitest)                                                                                               |
| API tests    | `.buildkite/scripts/api-tests.sh`: starts the database and API, then runs the Playwright API tests                 |
| UI tests     | `.buildkite/scripts/ui-tests.sh`: starts the database, API and web app, then runs the Playwright tests in Chromium |

On builds of `main` there is a sixth step, **Test summary**, which posts the results to Slack (see "Slack test summary" below). It is not a check on pull requests.

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

Buildkite steps run in parallel on fresh agents, so each step runs the setup once.

## Setting up Buildkite

The repository only holds the pipeline definition. You create the Buildkite side yourself. Buildkite's menus change from time to time, so use [Buildkite's documentation](https://buildkite.com/docs) if a name here does not match.

1. Create a Buildkite account and an organization.
2. Create a pipeline, connect it to this GitHub repository, and give it the first step `buildkite-agent pipeline upload`. That step reads `.buildkite/pipeline.yml` from the repository, so changes to the pipeline go through pull requests like any other code.
3. Run the pipeline on Buildkite's hosted agents (no machine of your own is needed).
4. Create three **secrets** that the test steps read with `buildkite-agent secret get`:

| Secret                  | Used by                  | Value                                                                    |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `E2E_ADMIN_PASSWORD`    | API tests, UI tests      | The seeded admin password (see "Demo accounts" in the README)            |
| `E2E_CUSTOMER_PASSWORD` | API tests, UI tests      | The seeded customer password                                             |
| `SLACK_BOT_TOKEN`       | Test summary (main only) | The Slack bot token from the next section. Only needed for Slack posting |

The email addresses are set in `.buildkite/pipeline.yml` (`E2E_ADMIN_EMAIL`, `E2E_CUSTOMER_EMAIL`). Never put a password or token in the repository or the pipeline file.

5. Connect Buildkite to GitHub so each step reports a status on pull requests (the `notify` blocks in the pipeline create the per-check names such as `buildkite/API tests`).

## Slack test summary

After a build on `main`, the **Test summary** step posts a short message to a Slack channel: how many tests ran, passed and failed, and for each failed test its name and the first lines of the error. It runs even when the test steps fail (the pipeline has a `wait` with `continue_on_failure`), because that is when the message matters most.

How it works:

- Both test steps write a Playwright JSON result file (`apps/e2e/playwright-results/api.json` and `ui.json`) and upload it as a build artifact. The JSON reporter is switched on by the environment variable `PLAYWRIGHT_JSON_OUTPUT_NAME`, so local runs are unchanged.
- The Test summary step downloads those files, reads the token from the secret store, and runs `node .buildkite/scripts/slack-summary.mjs <result files>`.
- The script posts with Slack's `chat.postMessage`. Slack answers HTTP 200 even when it refuses a message, so the script checks the `ok` field in the reply and fails the step with Slack's error text if it is false.
- With no token set, the script prints the message instead of sending it, so you can try it safely on your own machine: `node .buildkite/scripts/slack-summary.mjs apps/e2e/playwright-results/*.json`.

### Slack setup

These steps need a Slack workspace where you may add apps. A free workspace is enough. Slack's menus change from time to time, so check [Slack's documentation](https://docs.slack.dev) if a name does not match.

1. Create a channel for the results. The script's default is `test-results`; set the environment variable `SLACK_CHANNEL` to use another name. Make it a **public** channel.
2. Go to https://api.slack.com/apps and create a new app **from scratch**, in your workspace. This repository's app is called Test Reporter, but any name works.
3. Under **OAuth & Permissions**, add two **Bot Token Scopes**: `chat:write` and `chat:write.public` (the second lets the app post to a public channel without being invited).
4. **Install** the app to the workspace.
5. Copy the **Bot User OAuth Token**. It starts with `xoxb-`. Treat it like a password: do not paste it into the repository, a chat or a screenshot.
6. Save it as the Buildkite secret `SLACK_BOT_TOKEN`.
7. Merge a change to `main` and check that the message arrives. If the step fails, read the `Slack error:` line in its log. For example `channel_not_found` means the channel name is wrong or the channel is private, and `invalid_auth` means the token is wrong.

Slack's older incoming webhooks are not used here. A bot token with `chat.postMessage` is the current route and can later be reused for other features, such as replying in a thread.

## Using another CI tool

The checks are plain commands, so the same setup can be rebuilt on another CI tool. **This table is a guide only. Only Buildkite is set up and tested for the five checks and the Slack summary in this repository.** The paused GitHub Actions workflow still has the older, smaller set of checks, and nothing exists for Azure DevOps. Check each tool's current documentation before copying a name.

| Need                                 | Buildkite (used here)                          | GitHub Actions                               | Azure DevOps Pipelines                                  |
| ------------------------------------ | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| Pipeline file                        | `.buildkite/pipeline.yml`                      | `.github/workflows/*.yml`                    | `azure-pipelines.yml`                                   |
| One check per job                    | a step with `notify: github_commit_status`     | a job, shown as its own check                | a job or stage, reported as a check on the pull request |
| Run steps in parallel                | steps with no `wait` between them              | jobs run in parallel unless they use `needs` | jobs run in parallel unless they use `dependsOn`        |
| Shared setup                         | `setup.sh`, sourced by each step               | composite action `.github/actions/setup`     | a template file, or a script step                       |
| Passwords and tokens                 | secrets read with `buildkite-agent secret get` | repository secrets, read as `secrets.NAME`   | secret variables or a variable group                    |
| Keep results and reports             | `artifact_paths`                               | upload-artifact action                       | publish pipeline artifact task                          |
| Run the summary even after a failure | `wait` with `continue_on_failure`              | a final job with `if: always()`              | a final job with a `succeededOrFailed()` condition      |
| Only on `main`                       | `if: build.branch == "main"`                   | `if: github.ref == 'refs/heads/main'`        | a condition on `Build.SourceBranch`                     |
| Database and services for the tests  | Docker Compose on the agent (`start-stack.sh`) | the same script on the runner, or services   | the same script on the agent                            |

What carries over unchanged: every script in `.buildkite/scripts` that does not call `buildkite-agent` (and the whole of `slack-summary.mjs`), the Playwright JSON reporter setting, and the pnpm commands. What must be rewritten: the pipeline file itself, and the two places that call `buildkite-agent` (`secret get` and `artifact download`).

## Run the checks locally

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test
# or the same grouped run as CI, without the install:
SKIP_SETUP=1 .buildkite/scripts/code-quality.sh
```

## Requiring checks before merging

The pipelines only report results. Nothing is enforced until the repository has a branch protection rule (or ruleset) on `main` in GitHub, under Settings > Branches (or Rules):

- Require a pull request before merging (no direct pushes to `main`).
- Require status checks to pass, and select the Buildkite statuses: `buildkite/Code quality`, `buildkite/Build`, `buildkite/Unit tests`, and optionally `buildkite/API tests` and `buildkite/UI tests`. In this repository the UI tests check is intentionally not required. Each step posts its own GitHub commit status through a `notify` block in `.buildkite/pipeline.yml`; without it GitHub only sees one line (`buildkite/enterprise-shop`) for the whole build, which is also fine to leave as it is.
- Do **not** require the GitHub Actions checks (`Lint (ESLint)`, `Format (Prettier)` and so on) while that workflow is paused: they never report, so every merge would be blocked. Add them only when the workflow is switched back on.
- Require branches to be up to date before merging.

Note: required status checks and rulesets on private repositories need a paid GitHub plan; on a free plan they are available for public repositories.

If a check is renamed, update the required checks in GitHub, because the rule matches on the name.
