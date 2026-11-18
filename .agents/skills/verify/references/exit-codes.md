# Exit codes

Pick the row by the exit code and `error.code`, never by `error.message`. Read the message only for
the cause. For an `error.code` with no row, do what the `internal` row says.

| Exit | `error.code`         | Do                                                                                                                                                             |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | none                 | Go on.                                                                                                                                                         |
| 1    | `check-failed`       | Read the files in `evidence`. When `done` failed, run the journey again. Else compare the app, as step 5 of [Check a change](../SKILL.md#check-a-change) says. |
| 2    | `usage`              | Fix the command; `--help` shows its flags.                                                                                                                     |
| 3    | `read-only`          | Leave the write undone, skip `done` for the feature, and list the write in your reply.                                                                         |
| 3    | `doctor-required`    | Run the commands in `error.hint`, then run the feature's journey again.                                                                                        |
| 3    | `not-running`        | Start a run with `up` or `attach`, as step 2 of [Check a change](../SKILL.md#check-a-change) says.                                                             |
| 3    | `target-not-allowed` | Follow `error.hint`.                                                                                                                                           |
| 4    | `environment`        | Read `error.message` and `error.hint`, fix the problem, such as a missing browser, and run the command again.                                                  |
| 4    | `internal`           | Report the command and `error.message` in your reply: the CLI has a bug.                                                                                       |
| 5    | `timeout`            | Run the command again once, with twice the timeout; the default is `--timeout-ms=120000`. Report a second timeout in your reply.                               |
