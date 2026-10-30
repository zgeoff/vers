# The docs/ tree

One architecture doc covers one concept, and one guide covers one user task. The repo has no total
line budget: the total follows from the doc list.

| Folder               | Holds                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `docs/README.md`     | the index                                                                 |
| `docs/vision.md`     | what the project is for, as [The vision doc](#the-vision-doc) shapes it   |
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
  packages in `docs/design/<work>/spikes/<name>/` or wherever the repo's project skill keeps them.
  Each spike takes the structure in [Spikes](#spikes). A plan for work about to be built is no
  design: it lives in its issue or PR. When the work lands, the built part moves into
  `docs/architecture/` and the design folder is deleted.
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

## The vision doc

`docs/vision.md` holds what the project is for. The README and the architecture docs cover what the
code does and how it works, and neither holds the project's purpose. A design for a change in the
repo starts from the vision doc, so the doc states each choice in a form that a design can quote. It
holds these sections, in this order:

1. An H1 with the project's name and one sentence on what the project is for.
2. `## Goals`: what the project sets out to do, as bullets.
3. `## Non-goals`: what the project leaves out on purpose, each with the reason in the same bullet.
4. `## Who it serves`: the people or systems that use the project, and what each one needs from it.
5. `## Trade-offs`: each trade-off the project makes, as what it gives up and what it gets for it.
6. `## Current stage`: how far the project is from its goals, in 1 to 3 sentences.

The doc fits one page: 60 lines at most. Write each goal as an outcome, never as a mechanism, which
the architecture docs own. When the project changes direction, rewrite the section the change made
false, as every other doc does. A repo that takes the `docs-vision-check` entry of repo-sync gets
`check-vision.sh`, and `check-length.sh` runs it, so the repo's doc checks fail when its vision doc
is missing or over 60 lines.

## Spikes

A spike is an experiment that answers one question for a design. The repo's `project-docs-writing`
skill names the folder its spikes live in, such as `research/<name>/` or
`docs/design/<work>/spikes/<name>/`. Every spike has the same shape:

```text
<spike>/
  README.md     the landing page, held to the folder README limit
  results.md    the full report: versions, setup, every table, the reasons, the full untested list
  <run>.md      only for a separate run, such as a run on a deployment host
  code, runs/, results/ …
```

The README holds these sections, in this order:

1. An H1 `Spike: <title>` and 2 to 3 sentences: what the spike measures, and for which decision.
2. `## Question`: the question in one paragraph.
3. `## Answer`: the verdict and the headline numbers in 5 bullets or fewer, then the recommendation
   in one line.
4. `## Run it`: one code block, and a link to the `## Setup` section of `results.md` for the flags
   and versions.
5. `## Results`: one line that links `results.md` and any sibling run file.
6. `## Untested`: 1 to 2 lines, with a link to the `## Untested` section of `results.md`.

A spike that only reads sources, with no code, leaves out `Run it`. No other file in a spike is
named `README.md`, because `check-length.sh` holds every README to a README limit. `results.md` and
the spike's other files have no line cap, even under `docs/design/`, and `check-prose.sh` and
`check-links.sh` read `results.md` wherever the spike sits.
