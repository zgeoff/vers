---
name: verify
description:
  'Uses the vers web game the way a player would with `bun verify`, and records the verdict that a
  feature works. Load it before you check a change in the running game, run the journey of a
  feature, or put the verdicts in a PR.'
metadata:
  wringer-template: 'sha256:5ad8a6ead397'
  wringer-command: bun verify
---

# Verify vers

Use `bun verify` to start the app, use each feature your change touches the way a user would, and
record a verdict that it works. Put the report in the PR with `bun verify publish`, and hand back
the PR link and each feature you could not verify. The CI gate, `bun verify gate`, fails a PR that
changes a feature with no verdict.

The mistakes that cost the most time:

- **Using the app before `doctor` passes.** `bun verify doctor` checks that the app answers and that
  each driver works. Until it passes on the run that `up` or `attach` started, any command that
  touches the app fails with exit code 3.
- **Editing the app's code while `up` runs it.** The next command that touches the app fails with
  `doctor-required`. Run `bun verify up --restart` and `bun verify doctor`, then the journey again.
- **Running `done` before you check the end state.** `done` checks only that one command of the
  journey succeeded. Check the result yourself first.
- **Branching on the error message.** Branch on the exit code and `error.code`. The message text can
  change in any release.

## Key rules

- [Check a change](#check-a-change): for each changed feature, run its journey, check the end state,
  then `done`.
- [Read the envelope](#read-the-envelope): branch on the exit code and `error.code`.
- [Targets](#targets): check a change on a target that `up` starts.
- [Commands](#commands): `bun verify --help` lists every command.
- [Update a feature file](#update-a-feature-file): fix a broken journey in the same PR, and run
  `lint`.

## References

Read a feature's file before you run its journey: what the feature does, how a user reaches it, the
journey of `bun verify` commands, and the end state that shows it works.

<!-- wringer:features -->

| Feature         | Summary                                                                  | File                                                                           |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| signup          | Sign up with an emailed code, and land signed in with a user row         | [references/feature-signup.md](references/feature-signup.md)                   |
| avatar-roster   | Create and switch avatars, and see the roster and the database agree     | [references/feature-avatar-roster.md](references/feature-avatar-roster.md)     |
| offline-run     | Start a run offline, and see it sync and verify once the network returns | [references/feature-offline-run.md](references/feature-offline-run.md)         |
| device-takeover | Sign in on a second device, and see the first one told it was taken over | [references/feature-device-takeover.md](references/feature-device-takeover.md) |

<!-- /wringer:features -->

## Check a change

1. Run `bun verify report`. A feature in `data.report.features` shows `changed: true` when a file
   under its `paths` differs from the default branch, committed or not. Each changed feature needs a
   verdict.
2. Unless your task names another target, start a run on `local`, with the commands in the
   [Targets](#targets) table. Expect from `up` or `attach`: `ok: true`, and the app's endpoints in
   `data.endpoints`.
3. Run `bun verify doctor`. Expect: `data.passed: true`. When a check fails, fix its cause, and run
   `doctor` again.
4. Run the journey from the feature's file in [References](#references). Its first line,
   `use --feature`, records each later command under that feature, and leaves the target as it is.
   Expect: each command exits 0.
5. Compare the app with the feature's end state:
   - When it matches, and no command failed with `read-only`, go on to step 6.
   - When your change broke the feature, fix the app's code. Then run `bun verify up --restart`,
     `bun verify doctor` and the journey again.
   - When your change means to change the end state, fix the feature's file, and run
     `bun verify lint`. Then run the journey again.
   - Otherwise, skip `done` for this feature. List it in your reply with the end state you expected
     and the `data` you got.
6. Run `bun verify done` to record a verdict for the feature that `use --feature` set. Expect:
   `ok: true`. It fails with `check-failed` until a journey command succeeds after `doctor`.
7. Repeat steps 4 to 6 for each feature with `changed: true`, and for each feature your task names,
   in the order of the table in [References](#references). When [Targets](#targets) names a journey
   to run last, run it last.
8. Run `bun verify report --human` to read the report. Expect: `verified` on each changed feature.
   After `done`, an edit to a file under a feature's `paths` makes its verdict `stale`; a commit
   alone leaves each verdict as it was. Repeat steps 4 to 6 for each stale feature.
9. Run `bun verify publish`. Expect: `ok: true`, and `data.action` of `created`, `replaced` or
   `unchanged`. It writes the report into the description of the branch's open PR.
10. End the run: `bun verify down` after `up`, or `bun verify detach` after `attach`.

## Read the envelope

Each command prints one JSON envelope as its last line, or text for a person with `--human`. A
streaming command, such as `doctor`, prints JSON event lines before it. Read these fields:

- `ok`, then `data` on success, or `error.code`, `error.message` and `error.hint` on failure;
- `evidence`: the files the command kept, under `.wringer/`;
- `truncated` and `truncatedPath`: `data` was too large, and the file at `truncatedPath` holds it.

| Exit | `error.code`         | Do                                                                                                |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------- |
| 0    | none                 | Go on.                                                                                            |
| 1    | `check-failed`       | Read the evidence. When `done` failed, run the journey again; else go on as step 5 says.          |
| 2    | `usage`              | Fix the command; `--help` shows its flags.                                                        |
| 3    | `read-only`          | Leave the write undone, skip `done` for the feature, and list the write in your reply.            |
| 3    | `doctor-required`    | Run the commands in `error.hint`, then run the feature's journey again.                           |
| 3    | `not-running`        | Start the run, as step 2 says.                                                                    |
| 3    | `target-not-allowed` | Follow `error.hint`.                                                                              |
| 4    | `environment`        | Read `error.message`, fix the problem on this machine, such as a missing browser, and retry.      |
| 4    | `internal`           | Report the command and `error.message`: the CLI has a bug.                                        |
| 5    | `timeout`            | Retry once with twice the timeout; the default is `--timeout-ms=120000`. Report a second timeout. |

## Targets

Start a launch target's app with `bun verify up`, and stop it with `bun verify down`. Connect to an
attach target, an app that runs apart from `bun verify`, with `bun verify attach`.
`bun verify detach` leaves it running. Your edits never reach an attach target's app, so check a
change on a launch target.

Run `bun verify use --target <target>` to point every later command at a target. `--target` on one
command points that command alone.

<!-- repo: targets -->

| Target  | Start with                                            | Access     | Notes                                                                                               |
| ------- | ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `local` | `bun verify use --target local`, then `bun verify up` | read-write | Builds the web app, then starts Postgres in Docker, the services, the web server and an email stub. |

`up` needs Docker and the Chromium that `bun run verify:install-browser` installs. Each `up` and
`up --restart` starts an empty database, so run the signup journey first after each one. Run the
device-takeover journey last: it signs the browser out.

<!-- /repo -->

## Commands

Run `bun verify --help` for the list, with each command marked `[read]` or `[write]`. Run
`bun verify <command> --help` for a command's flags. The top-level list shows only the name of a
group, such as `action`: run `bun verify <group> --help` for its commands.

- Write a negative number with `=`, as in `--offset=-5`.
- Pass an object as JSON text, as in `--filter '{"shelf":"top"}'`.

<!-- repo: commands -->

- `action read-email --to <email>` gives the code of the last email to that address.
- `action read-game-state` gives the game worker's state, such as `liveRun` and `outbox`, for a
  `qa.versidle.com` account only. The signup journey says how to name the account.
- `action navigate-route --path <path>` opens a map node. The map is a canvas that `browser click`
  can't reach.
- `action set-network --network offline|online` cuts or restores the page's and worker's network.
- `action second-device-sign-in`, `second-device-click` and `second-device-snapshot` drive a second
  browser of their own. `--device second` points `navigate-route` and `read-game-state` at it.
- `action remove-account --email <email>` removes a journey account.
- `db query "<sql>"` reads the database.

A form sent within 1.5 s of its page loading shows "Something went wrong". Click submit again.

To tick a checkbox, click its label by `--ref` from a snapshot.

<!-- /repo -->

## Update a feature file

<!-- repo: registry -->

The [registry](../../../apps/web-e2e/src/verify/create-verify-registry.ts) declares the target,
actions, doctor checks and features.
[feature-paths.ts](../../../apps/web-e2e/src/verify/feature-paths.ts) holds each feature's `paths`,
the shared paths that count as a change to every feature, and the `.ignore` list. When you add a
glob to `paths` or the shared paths, add it to [skill-gate.json](../../skill-gate.json) with the
`verify` skill too: [feature-paths.test.ts](../../../apps/web-e2e/src/verify/feature-paths.test.ts)
fails until you do.

<!-- /repo -->

- When a feature's journey stops working because the feature changed, fix the journey in the same
  PR. You may edit any line of a feature file.
- A feature file needs `## Journey`, whose first `bash` line is `bun verify use --feature <name>`,
  and `## End state`.
- In this SKILL.md, edit only these parts. An upgrade of the template replaces every other line.
  - the frontmatter's `name` and `description`, and the `#` title;
  - the lines inside each `<!-- repo: <name> -->` block;
  - the table between the `wringer:features` markers: replace it with the output of
    `bun verify features --markdown`.
- Leave `metadata.wringer-template` as it is. When `lint` fails with check `template`, run
  `bun verify guide maintain`, and follow its steps to upgrade the template.
- Make each changed file match a feature's `paths` or a glob in the registry's `.ignore` list. The
  gate fails on a changed file that matches neither. `bun verify features` lists each feature's
  `paths`.
- After you change this skill, a feature file or the registry, run `bun verify lint`, and fix each
  failure it reports.

**Reply:** the PR link that `bun verify publish` returned in `data.pr.url`, and each feature you
could not verify, with the command that failed and its `error.code`, or the end state you expected
and the `data` you got.
