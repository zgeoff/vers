---
name: ci-design
description:
  "How CI runs in a zgeoff repo: job layout, test budgets, timeouts, reusable workflows, step
  scripts, path filters, cancelling, builds, checkout depth, reruns, first-party packages and
  dependency exceptions. Load it before you add, change or review a workflow, a job or a trigger, or
  a release-age exclude, override or audit ignore. For how to write tests, load the testing skill.
  Load the repo's project-ci-design skill beside it; where they disagree, the project skill wins."
metadata:
  kind: rule-set
---

# CI design

## Workflow lint

After you change a workflow, run `bun x @zgeoff/chex workflows` and fix every warning. CI stays
green on a warning.

## Jobs

Call [`bun-checks.yml`](https://github.com/zgeoff/tools/blob/main/.github/workflows/bun-checks.yml)
from zgeoff/tools in the repo's CI workflow, pinned as [Reusable workflows](#reusable-workflows)
says. Make its `checks` job a required check. GitHub lists it as `<your job> / checks`. In a public
repo, it fails when any other job fails.

Add CI work as a package script. `bun-checks.yml` runs `audit`, `deadcode`, `format:check`, `lint`,
`typecheck` and `test`, then the script of each [lane](../testing/references/slow-tests.md#lanes)
the repo defines: `test:e2e`, `test:browser`, `test:docker`, `test:host`, `test:agent-sdk` and
`test:crash`, from `laneNames` in
[`plan-check-scripts.ts`](https://github.com/zgeoff/tools/blob/main/packages/chex/src/ci-plan/plan-check-scripts.ts).
In a private repo, it runs every script in `checks`: GitHub bills each job at least a minute. In a
public repo, each lane script runs in its own `test-<lane>` job, such as `test-e2e`. `test` and each
other `test:<name>` script run in one `test` job. Every other script runs in one `static` job.

To run a script outside that list, set the repo variable `BUN_CHECK_SCRIPTS` to every script to run,
separated by spaces, such as `lint test test:e2e build`. It replaces the list, so name each listed
script you keep. Name only scripts in `package.json`: any other name fails the run.

Look up the repo's test budget in the Facts table of its project-ci-design skill. The budget limits
the median CI test time over recent runs that restored no `actions/cache` entry. Take each run's
slowest `test` or `test-<lane>` job in a public repo, and the sum of its test steps in a private
one. When the repo has no budget, skip each rule below that uses one.

- In a public repo, write a job of your own only when it saves 60 s of wall time over a script in
  `bun-checks.yml`. Shard tests only when the repo is over its test budget.
- In a private repo, write a job of your own only for a heavy check: one on any runner but a
  GitHub-hosted `ubuntu-*`, or one that sets up KVM. Run it on `schedule` or `workflow_dispatch`, as
  GitHub bills its minutes on every push to a pull request. Never make it a required check.
- When you make a job of your own a required check, give it no `if:` or path filter that can skip
  it. GitHub counts a skipped required check as a pass.

## Timeouts

Set `timeout-minutes` on every job that runs steps. GitHub refuses the key on a job that calls a
reusable workflow, so the called workflow sets its own. Set the timeout of `bun-checks.yml` with the
repo variable `BUN_CHECK_TIMEOUT_MINUTES`, and pass it to the workflow's `timeout-minutes` input:
`timeout-minutes: ${{ fromJSON(vars.BUN_CHECK_TIMEOUT_MINUTES || '20') }}` under `with:`.

Until the repo has a test budget and its tests have stayed within it for a week, set the timeout to
20 minutes. Then set it to twice the budget plus the job's median time outside its tests. For a job
with no tests, use twice its median time. Use at least 5 minutes. Read each median from recent runs.
In a public repo, one timeout covers every job: use the slowest test job's figures.

## Reusable workflows

Share steps as a reusable workflow. A composite action's failure shows as one red line, with no step
to point at. Before you write setup steps, check zgeoff/tools for a shared one. When you add the
call, pin it to the latest commit on `main`:

```yaml
uses: zgeoff/tools/.github/workflows/<name>.yml@<commit> # main
```

After that, never move the pin by hand.
[repo-sync](https://github.com/zgeoff/tools/blob/main/docs/architecture/repo-sync.md) in
zgeoff/tools opens a pull request in each repo that moves the pin to the new commit.

## Step scripts

Keep each `run:` to one plain command, such as `run: bun run --silent ci:tag-release`, with no `if`,
loop, `&&`, `||`, `;`, pipe or `${{ }}`. Pass an expression's value through `env:`.

Write the script a step runs in TypeScript, in a folder of `scripts/` named for the job that runs
it, such as `scripts/release/tag-release.ts` for a `release` job. Run it through a package script.
Keep it out of `.github/`: `bun test` skips hidden folders.

## Path filters

Filter a job only when its inputs are a known part of the tree, such as an image, a native build or
an e2e suite. Filter it with a `changes` job, never with `paths` on a trigger. If the workflow
doesn't start, its required check never reports and the pull request can't merge.

```yaml
jobs:
  changes:
    uses: zgeoff/tools/.github/workflows/paths-changed.yml@<commit> # main
    with:
      paths: |
        services/api/**
        bun.lock
        .github/workflows/image.yml
  image: # not a required check, so a skip is safe
    needs: changes
    # != 'false', so a failed changes job still runs the image build
    if: ${{ !cancelled() && needs.changes.outputs.changed != 'false' }}
```

## Cancelling runs

- Run the checks of a push to `main` in their own workflow, so no later push cancels them. In the
  pull-request workflow, cancel the older run when a newer commit arrives:

```yaml
concurrency:
  group: checks-${{ github.ref }}
  cancel-in-progress: true
```

- Never cancel a release, deploy or migrate job, because a deploy cut off halfway leaves its target
  half changed. Give it a job-level group, such as `deploy-${{ github.ref }}`, with
  `cancel-in-progress: false`. When the checks share that workflow, move their group to job level
  too. Then GitHub cancels only the checks, never the deploy.
- In a workflow that runs only on `main`, group by `github.sha`, with `cancel-in-progress: false`.

## Builds

- Build each artifact once per run. Pass an image on through the registry or buildx's `type=gha`
  cache, and a file through `actions/upload-artifact`.
- Never cache `~/.bun/install/cache` or `node_modules`. `bun install --frozen-lockfile` runs faster
  than the restore.
- When a job reads history, check out with `fetch-depth: 0` and `filter: blob:none`, or `filter: ''`
  when it reads many old files. For a diff against the base branch, use `fetch-depth: 2`.

## Merging and `workflow_run`

Don't require a branch to be up to date before merge. The push run on `main` tests the merged tree.

A `workflow_run` trigger takes a `branches:` filter, but a fork's `main` matches it. When the job
holds a secret or write access, check the event and the repo too:

```yaml
if: >-
  contains(fromJSON('["push","schedule"]'), github.event.workflow_run.event) &&
  github.event.workflow_run.head_repository.full_name == github.repository
```

## First-party packages

In a repo that sets no `minimumReleaseAge`, skip this section. `minimumReleaseAge` in `bunfig.toml`
makes `bun install` refuse each release younger than that age. Renovate bumps first-party packages
on publish, so without an exclude each new release fails to install. Add each package under a scope
that
[`first-party-scopes.ts`](https://github.com/zgeoff/tools/blob/main/packages/chex/src/dependency-gates/first-party-scopes.ts)
lists to the `minimumReleaseAgeExcludes` list in `bunfig.toml`, by its full name, such as
`@zgeoff/std`.

- Exclude each one the lock file installs, even one only another package depends on.
  `chex dependency-gates` lists each one that has no exclude.
- Never write a scope, such as `@zgeoff/*`. Bun accepts a scope entry with no warning, and the entry
  lets no package through.
- Never put a [dated removal comment](#dependency-exceptions) above a first-party exclude. The
  audit-fix workflow deletes an exclude on the date in that comment.
- Add a missing exclude in its own pull request on `main`, because Renovate rebuilds its own branch
  and drops your commit. After it merges, tick the rebase checkbox in each red Renovate pull
  request.

## Dependency exceptions

For any other package, add an exception only for a named reason, such as a fix the repo needs. If an
older release works, pin the newest one older than `minimumReleaseAge`, and add no exception. Add
the exception as one of these:

- For a release-age exclude, put the package's name in `minimumReleaseAgeExcludes`, and pin it to
  one exact version in the root `package.json` catalog or an override.
- For an override, add an entry to the `overrides` of `package.json`, pinned to one exact version,
  with no comment.
- For an audit ignore, add an `--ignore` flag for one advisory ID to the `audit` script in
  `package.json`. Key an entry in the root `audit-ignores.json` by that ID, with its `package`,
  `reason` and ISO `expires` date, the day the audit-fix workflow audits the advisory again.

Before you add a release-age exclude, check that the release has npm provenance:

```bash
npm view <package>@<version> dist.attestations.provenance
```

If it prints nothing, don't exclude the release: pin an older one, or wait until it passes
`minimumReleaseAge`.

When you add a release-age exclude, write a dated removal comment above it, in the form below. Give
the date the release passes `minimumReleaseAge`. Keep the wording exactly, "ages past the gate"
included, because the
[audit-fix workflow](https://github.com/zgeoff/tools/blob/main/.github/workflows/audit-fix.yml) and
`chex dependency-gates` match it:

```toml
# @scope/example 2.4.1 (published 2026-10-30) ages past the gate ~2026-11-06 — remove then
```

`chex dependency-gates` in `bun-checks.yml` fails the run when you break one of these:

- Never leave a release-age exclude past its date, or with no removal comment. Leave a first-party
  exclude without a comment.
- Never leave a first-party package with no exclude.
- Never keep an override that every locked version meets. It changes nothing.
- Never keep an audit ignore that no locked package needs.
