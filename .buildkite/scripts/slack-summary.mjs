// Reads Playwright JSON result files and posts one summary to Slack.
// Usage: node slack-summary.mjs <results-file> [<results-file> ...]
// Env:   SLACK_WEBHOOK_URL  (if missing, the message is printed instead of sent)
//        BUILDKITE_* variables are set by Buildkite and used for the build link.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_FAILURES_SHOWN = 15; // keeps the Slack message short
const MAX_REASON_LENGTH = 200;

// ---- 1. Helpers -------------------------------------------------------------

// Error messages contain colour codes, which look like junk in Slack.
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

// Keep the first few non-empty lines of an error (the first line alone is often
// just "expect(received).toBe(expected)") and shorten the result.
function shortReason(message = 'No error message') {
  const lines = stripAnsi(message)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  const text = lines.slice(0, 3).join(' | ') || 'No error message';
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH)}...` : text;
}

// Suites are nested, so walk them and collect every test that did not pass.
function collectFailures(suites, found = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== 'unexpected') continue; // 'unexpected' = failed
        const lastResult = test.results?.[test.results.length - 1];
        found.push({
          project: test.projectName,
          file: spec.file ?? suite.file,
          title: spec.title,
          reason: shortReason(lastResult?.error?.message),
        });
      }
    }
    collectFailures(suite.suites, found);
  }
  return found;
}

// ---- 2. Read every results file --------------------------------------------

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Give at least one Playwright JSON results file.');
  process.exit(1);
}

const totals = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
const lines = []; // one line per file, for example "api: 28 ran, 28 passed"
const failures = [];

for (const file of files) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const { expected, unexpected, flaky, skipped } = report.stats;
  totals.passed += expected;
  totals.failed += unexpected;
  totals.flaky += flaky;
  totals.skipped += skipped;
  const ran = expected + unexpected + flaky;
  const name = path.basename(file, '.json'); // api.json becomes "api"
  lines.push(`• ${name}: ${ran} ran, ${expected} passed, ${unexpected} failed`);
  collectFailures(report.suites, failures);
}

const ran = totals.passed + totals.failed + totals.flaky;

// ---- 3. Build the message ---------------------------------------------------

const icon = totals.failed > 0 ? ':x:' : ':white_check_mark:';
const commit = (process.env.BUILDKITE_COMMIT ?? '').slice(0, 7);
const commitMessage = (process.env.BUILDKITE_MESSAGE ?? '').split('\n')[0];
const buildUrl = process.env.BUILDKITE_BUILD_URL;

const message = [
  `${icon} *Test summary for ${process.env.BUILDKITE_BRANCH ?? 'local run'}*`,
  commit ? `Commit ${commit}: ${commitMessage}` : null,
  buildUrl ? `<${buildUrl}|Open the build>` : null,
  '',
  `*Ran ${ran}* | *Passed ${totals.passed}* | *Failed ${totals.failed}*` +
    (totals.flaky ? ` | Flaky ${totals.flaky}` : '') +
    (totals.skipped ? ` | Skipped ${totals.skipped}` : ''),
  ...lines,
]
  .filter((line) => line !== null)
  .join('\n');

let failureText = '';
if (failures.length > 0) {
  const shown = failures
    .slice(0, MAX_FAILURES_SHOWN)
    .map((f) => `• \`${f.project}\` ${f.file}: *${f.title}*\n   Reason: ${f.reason}`);
  const more = failures.length - shown.length;
  failureText =
    '\n\n*Failed tests*\n' + shown.join('\n') + (more > 0 ? `\n...and ${more} more` : '');
}

const text = message + failureText;

// ---- 4. Send it (or print it) ----------------------------------------------

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_CHANNEL ?? 'test-results';
if (!token) {
  console.log('SLACK_BOT_TOKEN is not set. Message that would be sent:\n');
  console.log(text);
  process.exit(0);
}

const response = await fetch('https://slack.com/api/chat.postMessage', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify({ channel, text }),
});
// Slack answers HTTP 200 even when something is wrong, so read "ok" in the body.
const result = await response.json();
if (!result.ok) {
  console.error(`Slack error: ${result.error}`);
  process.exit(1);
}
console.log(`Summary sent to #${channel}.`);
