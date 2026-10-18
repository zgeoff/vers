# The docs/ tree

One architecture doc covers one concept, and one guide covers one user task. The repo has no total
line budget: the total follows from the doc list.

| Folder               | Holds                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `docs/README.md`     | the index                                                                 |
| `docs/architecture/` | how the built system works, one doc per concept, with an overview         |
| `docs/guides/`       | the steps a user does, one doc per user task                              |
| `docs/runbooks/`     | operator and contributor procedures, development and releasing included   |
| `docs/reference/`    | generated reference only, such as the config JSON schema                  |
| `docs/decisions/`    | numbered decision records: the choice, the rejected alternatives, and why |
| `docs/design/`       | a design for big speculative work, opened by the owner and temporary      |

Group `docs/architecture/` in subfolders by area once it holds more than about 6 docs. The index
links `docs/reference/` once.

- **The code owns its reference.** Config keys, flags, and MCP tools are described in the code: the
  config schema (one `.describe()` per key, generated into `docs/reference/`), `--help`, and the
  tool descriptions. A configuration guide covers where config lives, worked examples, and a link to
  the schema.
- **Evaluations, research write-ups, plans, diagnoses, and history stay out of `docs/`**, outside
  `docs/design/`. A finding that is still a constraint becomes one sentence in the architecture doc
  that owns it; the rest goes to the issue tracker or is deleted.
- **A doc stays under 250 lines, and a runbook under 300.** Past the cap, cut points first, then
  split at a concept boundary. When the doc is still over, say so in the PR body. Never compress
  sentences to fit, never move the overflow into a README or code comments, and never split where
  the concept has no boundary. `check-length.sh` warns on a doc over its cap.
- **A design lives in `docs/design/<work>/`** while its code is unbuilt, with any spikes as runnable
  packages in `docs/design/<work>/spikes/<name>/`. A plan for work about to be built is no design:
  it lives in its issue or PR. When the work lands, the built part moves into `docs/architecture/`
  and the design folder is deleted.
- **A decision record is permanent, and a changed decision is edited in place.** A record states the
  choice, the alternatives it rejected and why, never how the system works now; the architecture doc
  owns that. When a decision changes, its record keeps its number and states the decision as it now
  stands, its header gains an `Updated` date, and a `## Changes` list at its end gives each change's
  date and a one-line summary. That list is the one place a record holds history, so the log grows
  only when a new decision is made.
- **Development and releasing live in runbooks.** `docs/runbooks/development.md` holds the
  contributor setup; `docs/runbooks/releasing.md` holds only the steps the release tooling doesn't
  do, and is deleted when none remain. A folder README that documents its own folder stays beside
  it.
