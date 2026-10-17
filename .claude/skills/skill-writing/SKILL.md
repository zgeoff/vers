---
name: skill-writing
description:
  How to write a Claude Code skill — what a SKILL.md and its references hold, how they point at code
  instead of copying it, how to keep them true, and the script that checks them. Load it before
  writing, editing, or reviewing a SKILL.md or a skill's references, and before answering a review
  finding on one.
---

# Writing skills

A skill holds what an agent cannot get from the code: when to load the skill, the commands to run
and what each needs, the traps that cost time, the reasons behind rules that look arbitrary, and
where to look next. The code, its doc comments, `--help`, and the docs own everything else, so a
skill points at them and never copies them. A copy goes stale the next time the code changes, and
nothing tells the agent that reads it.

The prose rules in [docs-writing](../docs-writing/SKILL.md) apply to a skill as they do to any
committed doc, and this guide doesn't repeat them. Where the two disagree about a skill, this guide
wins. Anthropic's guidance is in its
[best-practices page](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
and the [Claude Code skills reference](https://code.claude.com/docs/en/skills).

## Key rules

Each line links the section that explains it.

- [What a skill holds](#what-a-skill-holds): when to load it, the commands, the traps, and where to
  look; the code owns the rest.
- [Frontmatter](#frontmatter): `name` matches the folder, and `description` says what the skill does
  and when to load it.
- [The top of SKILL.md](#the-top-of-skillmd): open with a linked index of the key rules, then the
  list of references.
- [SKILL.md and references](#skillmd-and-references): split by how often a task needs the text, one
  level deep.
- [Point at the code, never copy it](#point-at-the-code-never-copy-it): a code name is a Markdown
  link to its file; no inventories, no narrations, and no stale quotes.
- [Answering a review of a skill](#answering-a-review-of-a-skill): decline a finding that asks for a
  copy of the code.
- [Keeping a skill true](#keeping-a-skill-true): rules, not incidents, and a script where a check
  can replace prose.
- [Checking a skill](#checking-a-skill): `check-length.sh`, `check-links.sh`, and `check-skill.sh`.

## What a skill holds

Most project skills take the same shape: a sentence on what the skill covers, a table of commands,
and a list of traps, each with its reason. A made-up example:

```markdown
# Widget tests

The `testing` skill holds the rules. This skill holds what is particular to the widget service.

## Commands

| Run                | Command                    | Needs                        |
| ------------------ | -------------------------- | ---------------------------- |
| One file           | `bun test <path>`          | Bun                          |
| Renderer snapshots | `bun run test:render`      | Chromium from `bun run deps` |
| Against real Redis | `REDIS_URL=<url> bun test` | A Redis you can flush        |

## Traps

- **The theme cache outlives a test.** [`loadTheme`](../../../src/theme/load-theme.ts) memoises per
  process, so a test that changes a theme file calls `resetThemes()` first.
- **Snapshots differ on macOS.** Font hinting changes the pixels, so update snapshots only from the
  Linux container.
```

Each trap is a fact the code doesn't show, plus what to do about it. A trap belongs in the skill
when an agent with the source open would still lose time to it.

## Frontmatter

`name` matches the skill's folder: lowercase letters, digits, and hyphens, at most 64 characters.

`description` is the only text the model sees when it chooses a skill, among possibly a hundred
others. Write it in the third person, say what the skill does and when to load it, and include the
words a task would use. It runs to at most 1,024 characters.

- Bad: "I help you with widgets."
- Good: "Commands, test layers, and traps for the widget service's tests. Load it beside the testing
  skill before writing, running, or reviewing a widget test."

## The top of SKILL.md

SKILL.md opens with everything an agent needs to act: one or two paragraphs on what the skill
covers, then an index of the key rules, then the list of references, then the sections that explain
each rule. After a compaction, only the start of a loaded skill stays in context, so a rule that
appears first only at the bottom is the first one lost.

The index is a table of contents with a takeaway: one line per section, a link to the section, and
the rule in a phrase.

```markdown
## Key rules

- [Cleanup](#cleanup): register `onTestFinished` right after each acquisition, with no hooks.
- [Time and waiting](#time-and-waiting): wait on a condition, never a sleep.
```

Each line restates its rule in one phrase and owns none of its detail, so the section stays the
rule's owner, and a change to the rule changes both. A skill short enough to read on one screen
needs no index.

The reference list follows the index. Each entry links one reference and names the task that needs
it, so an agent opens only the references its task touches:

```markdown
## References

- [Database](./references/database.md): a package that owns a schema.
```

## SKILL.md and references

SKILL.md holds what most loads of the skill need. A reference holds what only some tasks need: one
runner, one kind of doc, one rare case. Decide each section by how often a task needs it, never by
the line count, because a rule an agent needs on most tasks is easier to miss behind a second read.
Anthropic recommends a SKILL.md under 500 lines; past that, check that each section is one most
tasks need.

References sit one level deep. SKILL.md links each reference, and a reference never sends the reader
on to another reference, because an agent reads a nested file partially. A reference may link back
to a section of SKILL.md. A reference over 100 lines opens with a contents list, a list of links to
its own headings, so a partial read still shows what the file holds. Name each reference by its
domain (`database.md`, not `notes.md`).

Moving text from SKILL.md into references makes SKILL.md shorter and the skill no shorter. When a
skill is too long, cut points first, under docs-writing's "Cut anything the reader could get from
the code", and move only what few tasks need. A reference follows every rule in this guide.

## Point at the code, never copy it

A copy of the code takes four shapes, and each has a replacement.

### A pointer to a name

A pointer is allowed when the agent needs a name. Write the name as a Markdown link to its file, in
a sentence that holds a fact the code doesn't: a trap, a reason, or a choice. `check-links.sh`
checks a link, so a rename fails CI. A path in code formatting gets only a warning from
`check-skill.sh`, and nothing fails when it goes stale.

- Bad: "Call `createWidget` (`src/widgets/create-widget.ts`) to build one; it ignores `theme` when
  `size` is `compact`."
- Good: "[`createWidget`](../../../src/widgets/create-widget.ts) ignores `theme` when `size` is
  `compact`, so test a themed widget at the default size."

Code formatting without a link is for a command, key, or path the agent types. Never link to a line
anchor (`#L42`): the anchor goes stale on the next edit with no error. The link text holds the name
to find in the file.

In a skill, this rule replaces docs-writing's "Names" rule for code identifiers: a skill may name
the function, option, or file the agent needs, as a link.

### An inventory

An inventory is one row or bullet per file, function, option, or other member of something the code
defines. Replace it with the rule that defines the list and the search that lists it.

- Bad: a table with a row for each stand-in in `test-utils/`, naming the boundary each replaces.
- Good: "Each stand-in is a `build-stub-*` file in [test-utils](../../../test-utils/), and its doc
  comment names the boundary it replaces. Search there before writing one."

docs-writing allows a table whose key column is a list when its other columns hold facts the code
doesn't. In a skill, a table keyed by files, functions, or options is an inventory whatever its
other columns hold: move those facts into the code as doc comments, so the search returns them. A
table keyed by something the agent does or passes, such as the commands table above or the arguments
of a workflow the skill tells the agent to call, is no inventory: the agent needs it on every load,
at the call.

When agents need to browse a list, generate the reference from the code with a script, and have CI
fail when the reference drifts. When most loads of the skill need the list itself, such as the verbs
a repo's function names may start with, keep the list in the skill and add a check that fails when
it differs from the code, as `check-project-verbs.sh` does for the code-style skill.

### A narration

A narration retells what a script or function does, step by step. The agent can open the code, and
the retelling drifts from it. Keep the fact the agent acts on, and link the code that owns the
sequence.

- Bad: "`deploy.sh` reads the version, builds the image, tags it, pushes it, then calls the rollout
  endpoint."
- Good: "Run `deploy.sh <env>`. It pushes before it rolls out, so a failed push leaves the old
  version serving; rerun it. [`deploy.sh`](../../../scripts/deploy.sh) owns the sequence."

### A quoted example

A quote of real code text, such as a tool description, an error message, or a log line, is a copy:
it drifts when the code changes, and the example then teaches the old text. Quote it only when the
exact words are the point, and check the quote whenever the code it quotes changes. When the words
are not the point, write a made-up example and mark it as one.

### Live lists

Claude Code runs a line in SKILL.md written as an exclamation mark and a backticked command when the
skill loads, and inserts the command's output in its place. Use it only for a small fact that every
load needs and that changes often. Otherwise use the rule and the search.

- A command that fails, or that a permission rule doesn't allow outside auto mode, aborts the whole
  skill load. Pre-approve it with `allowed-tools` and end it with `|| true`.
- The command runs in the session's current directory, so address files through
  `${CLAUDE_PROJECT_DIR}` or `${CLAUDE_SKILL_DIR}`.
- The setting `disableSkillShellExecution` replaces the line with a placeholder, and an agent other
  than Claude Code sees the raw line.
- The output costs context on every load.

## Answering a review of a skill

Review bots and review agents ask for precision: the exact path, every member of a list, each step a
script takes. In a skill, a finding that asks for a copy of the code is declined under "Point at the
code, never copy it", and the reply names that rule. A finding that shows a sentence is wrong is
fixed, by correcting the fact or by replacing the copy with a pointer.

## Keeping a skill true

A skill states rules, not incidents. Keep the rule, and move the story, the issue IDs, and the dates
to the PR or the tracker.

When a script or a lint rule can check a rule, delete the rule's prose and say which check runs.
Push mechanical steps into a tested script in the skill's `scripts/` folder, and tell the agent to
run it, not read it: running a script loads only its output, and reading it loads its whole source.

Before adding a rule after a failure, find the existing rule that should have covered it and work
out why the agent missed it. Fix that rule instead of adding a near-duplicate, because two rules
that say nearly the same thing drift apart. When the code a skill covers changes, reread the skill's
sentences about it.

Write for a model that follows instructions closely:

- Use one term per concept. A second word for the same thing reads as a second thing.
- Leave out time-sensitive statements such as "until the next release". They become false silently.
- Use normal phrasing, not "CRITICAL" or "MUST". Current models over-apply emphasis, so give the
  reason with the rule and let the reason carry the weight.
- Give one default and an escape hatch, not a menu of equal options.
- Match the freedom to the fragility. Give exact commands for a fragile step, such as a migration or
  a release, and leave judgment to the agent for an open step, such as choosing a name.

## Checking a skill

Run these from the repo root:

```bash
bash .claude/skills/docs-writing/scripts/check-length.sh
bash .claude/skills/docs-writing/scripts/check-links.sh
```

`check-length.sh` runs docs-writing's prose check over each skill's Markdown, then runs
`check-skill.sh`. `check-links.sh` checks every relative link in each skill. `check-skill.sh` fails
on a frontmatter field outside its limit and on a line anchor. It warns about a SKILL.md over 500
lines, a reference that SKILL.md doesn't list under `## References`, a missing contents list, a
reference that links to another reference, and a code-formatted path that should be a link. To check
one skill, pass its folder:

```bash
bash .claude/skills/skill-writing/scripts/check-skill.sh .claude/skills/<skill>
```

A repo marks a third-party skill `linguist-vendored` in [`.gitattributes`](../../../.gitattributes),
and none of these checks read it.
