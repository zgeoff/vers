---
name: ci-design
description:
  How CI runs in a zgeoff repo — the public and private job profiles, job timeouts, test budgets and
  the audit data each main run uploads, reusable workflows instead of composite actions, path gates
  on pull requests with a full run on main, which jobs cancel and which never do, building once and
  passing the result, checkout depth, and triggers that rerun nothing. Load it before adding,
  changing, or reviewing a workflow, a job, a trigger, or a Renovate setting that starts CI runs.
---

# CI design

This skill holds the patterns that keep a pipeline from running a job whose result is already known.
Most of the CI time a pipeline loses outside its tests goes to jobs that run too often, such as a
rerun after a rebase nobody needed, and less goes to slow setup. A job runs when its inputs change,
builds each result once, and cancels only the runs whose result a newer commit replaces. The shared
reusable workflows live in zgeoff/tools, and a repo calls them at a sync tag, which Renovate moves
when a new tag is cut.

## Key rules

Each line links the section that explains it.

- [Two profiles](#two-profiles): a public repo runs parallel jobs for wall time, and a private repo
  runs one `checks` job of named steps for minutes.
- [Timeouts](#timeouts): every job sets a limit, 20 minutes until the repo's tests are within budget
  for a week, then the formula.
- [Test budgets and audit data](#test-budgets-and-audit-data): the budget covers the slowest test
  job in a public repo and the sum of the test steps in a private one, and each main run uploads the
  data the weekly audit reads.
- [Reusable workflows](#reusable-workflows): share setup as a reusable workflow in zgeoff/tools,
  never as a composite action.
- [Step scripts](#step-scripts): a `run:` holds one plain command, anything more goes in a
  TypeScript script under `scripts/<area>/`, and the workflow lint checks the rules a parser can
  see.
- [Path gates](#path-gates): a pull-request job runs only when its input paths change, through a
  `changes` job, and every push to main runs it in full.
- [Cancelling runs](#cancelling-runs): checks cancel when a newer commit arrives; release, deploy
  and migrate jobs never cancel.
- [Build once](#build-once): build each artifact once per run and pass it to the jobs that need it.
- [Checkout depth](#checkout-depth): depth 1 for a job that never reads history, a blobless full
  clone for one that does.
- [No rebase churn](#no-rebase-churn): rebase a bot's pull request only on a conflict, and filter a
  `workflow_run` trigger to the branch its job acts on.

## Loading the skill

This guide is the shared base that repo-sync delivers from zgeoff/tools; edit it there, never in a
downstream repo. When the repo has a `project-ci-design` skill, load it too. It holds the repo's own
pipeline, such as its required checks and its deploy jobs, and where the two disagree, the project
skill wins.

This skill covers how CI runs. How a test is written and run, including the worker count, the lanes
and the per-test time limit, is in the [testing](../testing/SKILL.md) skill, and this skill repeats
none of it.

## Two profiles

A repo's visibility picks the layout of its checks. A public repo spends no paid minutes, so it
splits work into parallel jobs to cut wall time. A private repo pays for every job, at least a full
minute each, so it runs one job. `bun-checks.yml` picks the profile from
`github.event.repository.private`, which in a reusable workflow reads the calling repo, and takes
the `private` input as the fallback for an event whose payload has no repository. A hand-written
workflow follows the same layout by hand.

| Profile | Jobs                                                  | Required check | Test budget covers        |
| ------- | ----------------------------------------------------- | -------------- | ------------------------- |
| Public  | `gitleaks`, `static`, `test`, `test-<lane>`, `checks` | `checks`       | the slowest test job      |
| Private | `checks`                                              | `checks`       | the sum of the test steps |

A public repo runs one `test-<lane>` job for each lane it has. A private repo's `checks` job runs
the secret scan, the static checks, the tests and each lane as named steps.

A ruleset requires `checks` in both profiles. A public repo's `checks` job needs every other job and
runs even after one fails or the run is cancelled. It fails when a job it needs failed or was
cancelled, and it passes a job skipped by design, such as the lane job of a repo without lanes. The
gate has to run every time, because GitHub counts a skipped required check as a pass: a ruleset that
requires a job which skips in its profile blocks nothing.

In a public repo:

- **Split work into its own job only when the split saves at least 60 s of wall time** against
  running it as a step. A job that saves less costs a runner start, a checkout and an install for
  nothing.
- **Start at most 10 jobs at once in one run.** The account's concurrent-job limit is shared by
  every repo, so a wide run queues the others.
- **Shard the test job only when the repo is over its budget after the speed work** in the testing
  skill.

In a private repo:

- **Add a second job only for another runner, such as KVM or macOS, or another trigger.** A heavy
  check runs nightly or on dispatch, not on each pull request.
- **Make the `checks` job the required check**, with no aggregator job after it.
- **Run the secret scan as a step.** A scan of a few seconds in its own job bills a full minute.
- **Path-gate a lane inside the job.** A step diffs the pull request's merge commit against its
  base, as the [path gate](#path-gates) does, and the lane's step `if:` reads its output, so a lane
  that a pull request cannot affect skips without a second job.

Both profiles gate side work on paths, cancel a superseded pull-request run, build once and set a
timeout on every job.

## Timeouts

Every job sets `timeout-minutes`. A job without one runs until the platform's own limit, and a hung
test burns that whole time. The limit is 20 minutes, the `bun-checks.yml` default, until the repo's
median test step is within its budget for a week, the same gate as the switch to the per-test time
limit. From then, the limit is twice the test budget plus the job's median time outside its tests,
with a floor of 5 minutes, so a regression fails the job instead of running long.

## Test budgets and audit data

A repo's test budget is a wall-time limit on its tests in CI. In a public repo, the budget covers
the slowest test job, because that job sets the run's wall time. In a private repo, the budget
covers the sum of the test steps in the `checks` job, because those steps bill one after another.

The budget is measured from data each run on main uploads. A weekly fleet audit reads the data from
every repo, compares it with each repo's time and memory budgets, and files an issue for a repo over
budget. A hand-written workflow uploads the same data from its test steps on each push to main, as
one JSON artifact:

- **Per-test times**, from `bun test --reporter=junit --reporter-outfile=<file>`. Bun writes no
  report unless both flags are present.
- **Peak memory**, from the memory cap script that wraps the test step.

## Reusable workflows

Share a run of steps between jobs or repos as a reusable workflow, called with `uses:` at the job
level. A composite action folds its steps into one step of the caller's log, so a failure shows as
one red line, and a reader opens the action's source to find which command failed. A reusable
workflow shows each of its jobs and steps in the run, with its own timings.

A shared reusable workflow lives in zgeoff/tools, and a repo calls it as
`zgeoff/tools/.github/workflows/<name>.yml@<sync tag>`. A repo-local reusable workflow sits in the
repo's own `.github/workflows/` and is called by its path. Before writing setup steps by hand, check
whether a tools reusable workflow covers them, and call it.

## Step scripts

A `run:` holds one plain command on one line, such as `run: bun run --silent ci:tag-release`. The
command holds no `if`, `for`, `while` or `case`, no `&&`, `||`, `;` or pipe, and no `${{ }}`: a
value from an expression reaches the command through `env:`. Logic in a `run:` block runs only in a
real run, and a step that runs only on release, on deploy or on failure never runs before it merges.
Logic in a script runs in the script's tests on every pull request, as the testing skill's
[workflows reference](../testing/references/workflows.md) describes.

- **A script is TypeScript run by Bun, in `scripts/<area>/`.** It runs each outside command through
  Bun's `$` shell, and the step calls it through a package script. An existing `.sh` step script
  stays.
- **Never put a script under `.github/`.** `bun test` skips the hidden folder, so a script and its
  test there never run in the repo's test suite.
- **A reusable workflow in zgeoff/tools downloads its script at the commit that defines the job.**
  The caller's checkout lacks the script, so the step reads `job.workflow_repository` and
  `job.workflow_sha` from the job context and downloads the file from that commit. A caller at a
  sync tag then runs that tag's script.

### The workflow lint

The workflow lint checks the `run:` rule and the rules in this skill that a parser can check
exactly. The `Lint workflows` step of `bun-checks.yml` runs it after the actionlint step over the
repo's workflows and the workflow callers that zgeoff/tools delivers. The pre-push baseline runs it
over the workflow files a branch changes. It reports each fault as a warning and passes, so a repo
that Renovate moves to a new sync tag keeps a green run while it clears the warnings.

| Rule                                    | The lint warns on                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [One command per `run:`](#step-scripts) | a `run:` that breaks the rule, where a quoted `;`, `\|` or `&&` is part of a word                                     |
| [Timeouts](#timeouts)                   | a job without `timeout-minutes`, other than a job that calls a reusable workflow, where GitHub refuses the key        |
| [Cancelling runs](#cancelling-runs)     | a checks workflow without `cancel-in-progress: true`, or with a group that holds a per-run value such as `github.sha` |
| [Cancelling runs](#cancelling-runs)     | a release or deploy job without its own group and `cancel-in-progress: false`, or under a workflow-level `true`       |
| [No rebase churn](#no-rebase-churn)     | a `workflow_run` trigger without a `branches:` filter                                                                 |
| [Two profiles](#two-profiles)           | a heavy check in a workflow that runs on `pull_request` or `pull_request_target`, unless the run is in a public repo  |
| [Build once](#build-once)               | an `actions/cache` step in a job that sets up Bun with `oven-sh/setup-bun`                                            |

The lint reads three terms by these definitions:

- **A checks workflow** runs on `pull_request` or `push`. When it holds a release or deploy job,
  each of its other jobs sets its own group with `cancel-in-progress: true`; otherwise the
  workflow-level group, or a group on every job, sets it.
- **A release or deploy job** has `release`, `deploy` or `migrate` in its id or its name, in any
  case.
- **A heavy check** is a job whose `runs-on` holds any runner label but a GitHub-hosted Ubuntu
  label: a macOS, Windows or self-hosted label, or a runner group. A job whose step runs a KVM setup
  command is heavy too, because it runs on an Ubuntu label. The fleet has no shared KVM setup step,
  so the lint lists each repo's own command, and a new one needs a change to the lint in
  zgeoff/tools. The lint reads a step's commands through a fixed set of shell and Bun forms, and a
  step outside them, such as one that runs a command substitution, counts as no KVM setup. A
  `runs-on` that holds an expression is never heavy, because GitHub resolves it only when the job
  runs.

The heavy-check rule binds a private repo alone. In CI the lint reads the run's profile and skips
the rule in a public repo. The pre-push baseline cannot see the profile, so the hook warns in every
repo.

## Path gates

A workflow whose jobs are required checks runs on every pull request. `on.pull_request.paths` skips
the whole workflow, and a skipped workflow never reports, so a required check stays pending and the
merge blocks. A job skipped by its own `if:` reports success instead. The path gate uses that: a
`changes` job outputs whether the pull request touches the job's inputs, and each later job reads
the answer.

Call `zgeoff/tools/.github/workflows/paths-changed.yml@<sync tag>` as the `changes` job:

| Input or output | What it holds                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- |
| `paths` input   | the path patterns, one per line, as in `on.pull_request.paths`; `*` and `**` both match `/` |
| `changed`       | `'true'` when the pull request changes a matching file or the event is not a pull request   |

A made-up caller for an image build:

```yaml
on:
  pull_request:
  push:
    branches: [main]

jobs:
  changes:
    permissions:
      contents: read
    uses: zgeoff/tools/.github/workflows/paths-changed.yml@<sync tag>
    with:
      paths: |
        services/api/**
        bun.lock
        .github/workflows/image.yml

  image:
    needs: changes
    if: ${{ !cancelled() && needs.changes.outputs.changed != 'false' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo build
```

- **Gate on `!= 'false'`, never `== 'true'`.** A failed or cancelled `changes` job leaves the output
  empty, and the gated job then runs the work instead of passing without it.
- **List the workflow file in `paths`.** A change to the workflow is a change to the job's inputs.
- **Give the push trigger no `paths`.** The gate outputs `'true'` on a push, so every push to main
  runs every job, and main tests the merged tree even when a pull request skipped a job.
- **Gate a job whose inputs are a known part of the tree.** An image, a native build or an
  end-to-end suite fits, because a pull request that changes none of its paths cannot change its
  result.

## Cancelling runs

A newer commit makes the checks of the older one worthless, so a checks workflow cancels its older
runs, on pull requests and on pushes to main:

```yaml
concurrency:
  group: checks-${{ github.ref }}
  cancel-in-progress: true
```

A release, deploy or migrate job never cancels, because a cut-off deploy can leave a target half
changed. Give each such job its own job-level `concurrency` group with `cancel-in-progress: false`,
so the checks group can cancel the run's checks without reaching the deploy. A workflow-level
`cancel-in-progress: true` covers every job in the workflow, so a workflow with a deploy job sets
its groups per job.

```yaml
jobs:
  deploy:
    needs: checks
    concurrency:
      group: deploy-production
      cancel-in-progress: false
```

## Build once

Build each artifact once per run, and hand it to every job that needs it. A container image builds
in one job and passes on through the registry, or through buildx with the GitHub Actions cache
(`cache-from: type=gha` and `cache-to: type=gha,mode=max`), so a later job pulls the layers instead
of rebuilding them. A file passes on with `actions/upload-artifact` and `actions/download-artifact`.

A Bun job runs `bun install --frozen-lockfile` with no `actions/cache` step for
`~/.bun/install/cache`. On a GitHub-hosted runner, a restore of that cache takes longer than the
install it replaces, and a job that misses the cache spends more time to save one. Each job pays for
its own runner, checkout and install, which [Two profiles](#two-profiles) weighs against wall time.

## Checkout depth

A job that never reads history checks out at depth 1, the `actions/checkout` default. A job that
reads history, such as a secret scan over a pull request's commits, an affected-packages build, a
size check against the base, or a commit-message check, clones the full history without the file
contents:

```yaml
- uses: actions/checkout@<pinned sha>
  with:
    fetch-depth: 0
    filter: blob:none
```

A blobless clone fetches every commit and tree, and git fetches a file's contents when a command
first reads them. A history that holds large old files then costs the same to clone as a small one.
A job that diffs only the pull request against its base needs the merge commit and its parents,
`fetch-depth: 2`.

## No rebase churn

A rebase that nobody needs reruns every check on the branch. The shared Renovate preset sets
`rebaseWhen: "conflicted"`, so Renovate rebases an open pull request only when it conflicts with the
base branch. A ruleset never requires a branch to be up to date before it merges: the push run on
main tests the merged tree, and an up-to-date rule turns each merge into a rebase and a rerun for
every open pull request.

A `workflow_run` trigger starts on every completed run of the named workflows, on every branch. A
job that acts on one branch, such as an audit of the default branch, filters the trigger with
`branches:` to that branch, so a pull-request run starts nothing.
