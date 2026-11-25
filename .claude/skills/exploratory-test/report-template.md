# Exploratory test report: <feature or flow>

|                |                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| Date           | <YYYY-MM-DD>                                                                             |
| Feature / flow | <what was tested>                                                                        |
| Started by     | <person, or the Slack command, or "manual">                                              |
| App address    | <URL>                                                                                    |
| Device         | <Desktop browser name, or device name, or "viewport resized to WxH (not a real device)"> |
| Rules used     | <files or text the expected behaviour came from>                                         |
| Recording      | <file name, or "not recorded: reason">                                                   |

## 1. Summary

**Overall:** <one or two plain sentences: what was tested and the main outcome>

| Pass | Fail | Blocked | Not verified |
| ---- | ---- | ------- | ------------ |
| <n>  | <n>  | <n>     | <n>          |

**Most important findings:**

- <F1: one line, or "None">

## 2. Scenarios run

| ID  | Scenario                 | Expected result (source) | Result                               | Evidence             |
| --- | ------------------------ | ------------------------ | ------------------------------------ | -------------------- |
| S1  | <main flow, in one line> | <expected> (<source>)    | Pass / Fail / Blocked / Not verified | <file or finding id> |
| S2  | <edge case>              | <expected> (<source>)    |                                      |                      |

Results: **Pass** = matched the rule. **Fail** = did not match the rule. **Blocked** = could not be run (reason in the Evidence column). **Not verified** = ran, but no rule exists to check it against.

## 3. Findings

Repeat this block for each finding. Write "No findings." if there are none.

### F1: <short title>

|            |                                                              |
| ---------- | ------------------------------------------------------------ |
| Scenario   | <S id>                                                       |
| Severity   | High / Medium / Low (a suggestion, for the owner to confirm) |
| Confidence | Confirmed (repeated) / Seen once                             |

- **Expected:** <what should happen> (<source>)
- **Actual:** <what happened, quoting the screen or log>
- **Steps:** 1. <step> 2. <step> 3. <step>
- **Evidence:** <screenshot file name> · <console or network excerpt>

## 4. Console, API and network check

| Step or scenario | Console                 | API / network                        | Gap or concern                |
| ---------------- | ----------------------- | ------------------------------------ | ----------------------------- |
| <S id, step>     | <clean / errors quoted> | <requests of interest, status codes> | <what looks wrong, or "none"> |

Only list rows with something to say. Write "No console errors and no failed requests were seen" when that is true, and say which scenarios it covers.

## 5. Questions and items not verified

- <doubt or unclear rule that needs the owner's answer>

## 6. Noticed elsewhere (not investigated)

- <short note, or "None">

## 7. Regression test ideas

- <idea for a deterministic test, mapped to the scenario it came from>

## 8. Evidence index

| File   | What it shows |
| ------ | ------------- |
| <name> | <one line>    |

## 9. About this run

- Tools used: <e.g. Playwright MCP version>
- Limits: <anything that could not be checked and why, for example no recording, resize instead of device>
- Nothing in this report was filed, pushed or published unless stated here: <state>
