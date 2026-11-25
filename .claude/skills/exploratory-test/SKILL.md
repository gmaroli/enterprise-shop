---
name: exploratory-test
description: Run an exploratory test of any feature or user flow in the Enterprise Shop through the browser (Playwright MCP). Walks the flow the way a real user would, tries edge cases, checks the console, API and network logs for gaps, and writes one report in a fixed template. Use when asked to "run an exploratory test", "explore the <feature>", "test this new feature as a user would", or "run a session on <flow>".
---

# Exploratory test

Use this skill to test one feature or user flow of the shop as a real user would: open the app in the browser, follow the flow from start to finish, try the edge cases that matter for that flow, and watch the console, API and network logs while doing it. It works for any feature, including ones added after this skill was written. The user names the feature or flow, and the skill does not depend on a fixed list.

Every run ends with one report in the same template (see the report section), so reports from different runs can be read and compared the same way.

The skill reports only what it actually saw. It does not guess, fill gaps with assumptions or invent results. Where something is unclear or could not be checked, it says so.

## Inputs

A run needs three things. Anything missing is asked for, never guessed.

1. **Feature or flow**: what to test, for example "the new wishlist" or "checkout with a coupon". If the run was started by something that cannot answer questions (a scheduled job, or a chat command later), stop and report "blocked: flow not specified" instead of choosing one.
2. **Expected behaviour**: where the rules come from. Use the user's description first, then `docs/requirements.md` and `docs/api.md`. Every expectation in the report names its source. If no source describes the behaviour, record it as an observation or question, never as a defect.
3. **Target**: the app address (default `http://localhost:3001`) and the device mode: desktop, mobile, or both.

## Procedure

Work through the steps in order. Do not skip ahead.

### 1. Pre-flight

- Confirm the web app (port 3001) and the API (port 4000) respond. Do not start, stop or reset anything. If they do not respond, stop and report that.
- Confirm the Playwright browser tools are available. Note whether the video tools (`browser_start_video`, `browser_stop_video`) are available. If they are not, say in the report that no recording was made. Never describe a recording that does not exist.
- Use only the test accounts and test data documented in the repo. Stripe stays in test mode. Never type real credentials or secrets.
- The browser runs headless (no visible window). `.mcp.json` sets `--headless`. If a window opens, note it in the report. Do not change the setting.
- Open one browser for the whole run. Do not start extra browsers or sessions.

### 2. Plan the scenarios

Before touching the app, write the list of scenarios to run and keep it for the report. Each scenario has an id, a short name and the expected result with its source.

- **Main flow**: the happy path, step by step, the way a real user would navigate it: start at the home page, use the visible links and buttons, and do not jump to internal URLs.
- **Edge cases for this flow**: derive them from the flow itself, for example empty or missing input, minimum and maximum values, invalid input, repeating an action, going back or refreshing mid-flow, a logged-out user, a user with the wrong role. Only include edge cases that make sense for this flow.

Keep the plan small and relevant. Do not test unrelated areas.

### 3. Execute

For each scenario:

1. Start a screen recording for the main flow, if the video tools are available, and add a chapter marker per scenario.
2. Act through the page as a user would. Take a snapshot after each important step.
3. After each important step, check the browser console messages and the network requests. Look for console errors and warnings, failed requests, status codes of 400 and above, unexpected redirects, slow or repeated calls, and responses whose content disagrees with what the page shows.
4. When the API log or response is needed to explain a result, read it only. Do not change data to prove a theory.
5. Compare what happened with the expected result and record one of: **Pass**, **Fail**, **Blocked** (could not be run, with the reason) or **Not verified** (ran, but could not be checked against any rule).
6. On any error or failed expectation, take a screenshot straight away and keep its file name for the report.

Stop the recording when the main flow ends. Never invent a step, a number or a message. Quote what was on the screen or in the log.

### 4. Mobile

When mobile is requested, repeat the main flow and the edge cases that depend on layout (menus, forms, buttons that are hard to reach, text that is cut off or overlaps).

- Preferred: a browser started as a phone, using the MCP `--device` or `--mobile` option.
- Fallback: resize the viewport to a phone size. This only approximates a phone, so the report must say it was a resize and not a device.

State in the report which device or size was used.

### 5. Close the browser

When the last scenario ends, and before writing the report:

1. Stop the recording if it is still running.
2. Close the browser with `browser_close`. This closes every tab and the browser this run opened.
3. Do this on every ending of the run, including when the run is stopped early, a scenario is Blocked, or a tool fails. Never leave a browser open for the next run.
4. If `browser_close` fails, say so in section 9 of the report ("About this run") and tell the user a browser may still be running. Do not claim it was closed.

Do not kill any process outside the run. Never touch the user's own browser.

### 6. Rules for the whole run

- Report only what was observed. No guessing, no filling gaps, no results from memory.
- Stay on the requested feature. A problem seen elsewhere goes in a short "Noticed elsewhere" list and is not investigated.
- Separate fact from interpretation. A defect needs expected result, actual result and evidence. A doubt goes under questions.
- Do not file issues, push code, change settings or publish anything unless the user said to in this run.

## Report

Every run writes exactly one report from `report-template.md`, in this folder. Use the template as it is: same sections, same order, same headings, every time. Do not add, remove or rename sections. A section with nothing to say keeps its heading and says "None".

- Write it plainly so any reader can follow it. Short sentences, no jargon without a word of explanation, one idea per line.
- Put the report in `qa-reports/<YYYY-MM-DD>-<feature-slug>/report.md`. Save screenshots and the recording in the same folder and refer to them by file name.
- Record every scenario from the plan in section 2 with its result, including the ones that were Blocked or Not verified. The scenario table is the high-level record of what was executed.
- Fill in the summary last, from the scenario table and the findings, so the numbers match. Check that the counts add up to the number of scenarios.
- Every finding needs expected result, actual result, steps and evidence. If any of these is missing, move it to "Questions and items not verified".
- Quote logs and messages exactly. Do not paraphrase an error.

### Publishing

The finished report is meant to go on a Confluence page. The owner will provide the page later, and no Confluence connection is set up yet. Until then:

- Leave the report as a local file and tell the user where it is.
- Offer to publish once a page address and a way to publish exist. Never publish without a clear yes in this run.
- Do not claim the report was published unless the publish tool confirmed it.

### Starting a run from Slack (later)

Not built yet. When it is, the Slack message only supplies the Inputs above (feature or flow, device, address), and the result is a short summary in Slack with a link to the full report. The procedure and the template stay the same.
