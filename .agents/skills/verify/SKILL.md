---
name: verify
description:
  'Uses the vers web game the way a player would with `bun verify`, and records the verdict that a
  feature works. Load it before you check a change in the running game, run the journey of a
  feature, or put the verdicts in a PR.'
metadata:
  wringer-template: 'sha256:3a8295eb8ec4'
  wringer-command: bun verify
---

# Verify vers

Use `bun verify` to start the app, use each feature your change touches the way a user would, and
record a verdict that it works. Put the report in the PR with `bun verify publish`, and hand back
the PR link and each feature you could not verify, or the blocker that stopped you before `publish`.
Leave `bun verify gate` to CI: it reads the report from the PR description, and fails a PR that
changes a feature with no verdict there.

The mistakes that cost the most time:

- **Using the app before `doctor` passes.** `bun verify doctor` checks that the app answers and that
  each driver works. A driver is a package, such as `@wringer/http`, that adds a group of commands,
  such as `bun verify http request`. Until `doctor` passes after `bun verify up` or
  `bun verify attach`, any command that touches the app fails with exit code 3.
- **Editing the app's code while `up` runs it.** The next command that touches the app fails with
  `doctor-required`. Run `bun verify up --restart` and `bun verify doctor`, then the journey again.
- **Running `done` before you check the end state.** `done` checks only that one command of the
  journey succeeded.

## Key rules

- [Check a change](#check-a-change): for each changed feature, run its journey, check the end state,
  then `done`.
- [Read the envelope](#read-the-envelope): branch on the exit code and `error.code`, never on the
  message, which can change in any release.
- [Targets](#targets): check a change on a launch target, a target whose app `bun verify up` starts
  from your worktree.
- [Commands](#commands): read `--help` before you guess a flag.
- [Edit the skill and the registry](#edit-the-skill-and-the-registry): map each new file in the
  registry, read the reference before you edit the skill, and run `lint`.

## References

- [Exit codes](references/exit-codes.md): when a command fails, what to do for its exit code and
  `error.code`.
- [Edit the skill](references/edit-the-skill.md): before you edit this skill or a feature file.

Read a feature's file before you run its journey.

<!-- wringer:features -->

| Feature         | Summary                                                                                    | File                                                                           |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| public-smoke    | Load the home page with no console error, and see /health and an anonymous RPC call answer | [references/feature-public-smoke.md](references/feature-public-smoke.md)       |
| signup          | Sign up with an emailed code, and land signed in with a user row                           | [references/feature-signup.md](references/feature-signup.md)                   |
| avatar-roster   | Create and switch avatars, and see the roster and the database agree                       | [references/feature-avatar-roster.md](references/feature-avatar-roster.md)     |
| offline-run     | Start a run offline, and see it sync and verify once the network returns                   | [references/feature-offline-run.md](references/feature-offline-run.md)         |
| device-takeover | Sign in on a second device, and see the first one told it was taken over                   | [references/feature-device-takeover.md](references/feature-device-takeover.md) |

<!-- /wringer:features -->

## Check a change

1. Run `bun verify report`. In `data.report.features`, a feature shows `changed: true` when a file
   that matches its `paths` in the [registry](#edit-the-skill-and-the-registry) differs from the
   default branch, committed or not.
2. Pick the target your task names. When it names none, take the first launch target in the
   [Targets](#targets) table. Run the commands in its row. `up` or `attach` starts a run, which
   lasts until `down` or `detach`. Expect from `up` or `attach`: `ok: true`, and the app's endpoints
   in `data.endpoints`.
3. Run `bun verify doctor`. Expect: `data.passed: true`. When a check fails, fix its cause, and run
   `doctor` again.
4. Run the journey from the feature's file in [References](#references). Its first line,
   `use --feature`, records each later command under that feature, and leaves the target as it is.
   Expect: each command exits 0. When one fails, do what its row in
   [Exit codes](references/exit-codes.md) says.
5. Compare the app with the feature's end state:
   - When it matches, and no command failed with `read-only`, go on to step 6.
   - When your change broke the feature, fix the app's code. Then run `bun verify up --restart`,
     `bun verify doctor` and the journey again.
   - When your change means to change the end state, fix the feature's file, and run
     `bun verify lint`. Then run the journey again.
   - In any other case, such as a `read-only` failure or a bug your change did not cause, skip
     `done` for this feature. List it in your reply with the end state you expected and the `data`
     you got.
6. Finish each edit to a file that matches the feature's `paths` before you run `done`. An edit
   after `done` makes the feature's verdict `stale`. A commit alone leaves the verdict as it was.
   Run `bun verify done` to record a verdict for the feature that `use --feature` set. Expect:
   `ok: true`. It fails with `check-failed` until a journey command succeeds after `doctor`.
7. Repeat steps 4 to 6 for each feature with `changed: true`, and for each feature your task names,
   in the order of the table in [References](#references). When the [Targets](#targets) section says
   to run a feature's journey last, run it after every other journey.
8. Run `bun verify report --human` to read the report. Expect: `verified` on each changed feature
   you did not skip in step 5. Repeat steps 4 to 6 for each `stale` feature.
9. Push the branch. When no PR is open for it, open one: `publish` fails without it.
10. Check that both `VERIFY_UPLOAD_URL` (the file host for the evidence) and
    `VERIFY_UPLOAD_TOKEN_REF` (the token's 1Password `op://` reference) are set. When either is
    empty, stop and report a blocker. Never run `op read` on its own: it prints the token.
11. Publish the report, even when you skipped a feature. The subshell keeps the token out of your
    shell, and `&&` stops the command before `publish` when `op read` fails: report that as a
    blocker.

    ```bash
    (VERIFY_UPLOAD_TOKEN="$(op read "$VERIFY_UPLOAD_TOKEN_REF")" && export VERIFY_UPLOAD_TOKEN && bun verify publish)
    ```

    For another PR, put `--pr <number>` after `publish`, inside the parentheses. Expect: `ok: true`,
    and `data.action` of `created`, `replaced` or `unchanged`. It writes the report into the PR's
    description, the only report the gate reads.

12. End the run, even after a blocker: `bun verify down` after `up`, or `bun verify detach` after
    `attach`.

## Read the envelope

Each command prints one JSON envelope as its last line, or text with `--human`. A streaming command,
such as `doctor`, prints JSON event lines before the envelope. Read these fields:

- `ok`, then `data` on success, or `error.code`, `error.message` and `error.hint` on failure;
- `evidence`: the files the command kept, under `.wringer/`;
- `truncatedPath`: the file that holds `data` when it was too large to print.

When a command fails, find its exit code and `error.code` in [Exit codes](references/exit-codes.md),
and do what that row says.

## Targets

Start a launch target's app with `bun verify up`, and stop it with `bun verify down`. Connect to an
attach target, a target whose app runs apart from `bun verify`, with `bun verify attach`.
`bun verify detach` leaves it running. Your edits never reach an attach target's app, so check a
change on a launch target.

Run `bun verify use --target <target>` to point every later command at a target. `use` saves the
choice in this worktree's `.wringer/`, for every shell and session. `--target` on one command points
that command alone. A command with neither runs on the registry's first target, so run `use` first.

<!-- repo: targets -->

| Target  | Start with                                               | Access     | Notes                                                                                          |
| ------- | -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `local` | `bun verify use --target local`, then `bun verify up`    | read-write | Builds the web app and starts Postgres in Docker, the services, the web server and email stub. |
| `prod`  | `bun verify use --target prod`, then `bun verify attach` | read-only  | The deployed game at versidle.com, for public-smoke only.                                      |

`up` needs Docker. Both targets need the Chromium from `bun run verify:install-browser`. Each `up`
starts an empty database and a signed-out browser. Later journeys use signup's account: run signup
first after each `up` or `up --restart`. Run device-takeover last: it signs out.

<!-- /repo -->

## Commands

Run `bun verify --help` for the list, with each command marked `[read]` or `[write]`. A read-only
target refuses each `[write]` command except `publish`, which writes no app data. `up` and `down`
are `[read]`, but start and stop the app. Run `bun verify <command> --help` for a command's flags.
The top-level list shows only the name of a group, such as `action`: run `bun verify <group> --help`
for its commands.

- Write a negative number with `=`, as in `--offset=-5`.
- Pass an object as JSON text, as in `--filter '{"shelf":"top"}'`.

<!-- repo: commands -->

- Open a map node with `action navigate-route`: `browser click` can't reach the canvas.
- `action second-device-sign-in` opens a second browser. `--device second` points `navigate-route`
  and `read-game-state` at it.
- Read the envelope from stdout. `bun` writes its own lines to stderr.

<!-- /repo -->

## Edit the skill and the registry

<!-- repo: registry -->

The [registry](../../../apps/web-e2e/src/verify/create-verify-registry.ts) declares the targets,
actions, checks and features. To change `paths`, read
[references/registry.md](references/registry.md).

<!-- /repo -->

In the registry, map each file your change adds: add a glob that matches it to a feature's `paths`,
to `.shared()` or to `.ignore()`. The gate fails on a changed file that no glob matches. Add a file
that the running app never reads, such as a test, to `.ignore()`. `bun verify features` lists the
globs.

When a change to a feature breaks its journey, fix the journey in the same PR. Before you edit this
skill or a feature file, read [Edit the skill](references/edit-the-skill.md). After you change this
skill, a feature file or the registry, run `bun verify lint`, and fix each failure it reports.

**Reply:** the PR link that `bun verify publish` returned in `data.pr.url`, or the blocker that
stopped you before `publish`, and each feature you could not verify, with the command that failed
and its `error.code`, or the end state you expected and the `data` you got.
