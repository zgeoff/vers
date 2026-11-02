---
name: project-ci-design
description:
  "vers's test budget and required checks, and the ci-design rule it replaces: vers runs its own
  checks job in place of bun-checks.yml. Covers where a new CI step or job goes, and which steps a
  deploy waits for. Load it beside ci-design before you add or change a workflow, a job or a step in
  vers."
metadata:
  kind: rule-set
---

# vers CI design

## Facts

| Fact            | Where                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Test budget     | 2 min                                                                             |
| Required checks | `gh api repos/zgeoff/vers/rules/branches/main`, the `required_status_checks` rule |

## Departures

- Write each check as a step of the `checks` job in [`pr.yml`](../../../.github/workflows/pr.yml).
  The [Jobs](../ci-design/SKILL.md#jobs) section of ci-design calls `bun-checks.yml` instead. The
  vers tests need the Postgres test container, the Turbo cache, and the full git history for
  `turbo --affected` and `bun run content:check-digest`. `bun-checks.yml` takes no input for any of
  them.

## Where a step goes

- Add each new check to the `checks` job in `pr.yml`, as a step.
- Add a step that checks the code a deploy ships, such as a lint or a test, to the `checks` job of
  [`main.yml`](../../../.github/workflows/main.yml) as well. Each deploy job in `main.yml` lists
  `checks` under `needs:`, so a deploy waits for every step there.
- Keep a check that a deploy doesn't need, such as the doc-link check or `bun run audit`, in
  `pr.yml` only.
- Add a job of its own only for work that needs another runner or other permissions. `size` runs
  alone because it needs write access to pull requests to post its comment.
- Run the unit tests with `bun run test --concurrency=4`, one Turbo task per vCPU of the 4-vCPU
  runner. Measure the step again before you change the count or the runner.
