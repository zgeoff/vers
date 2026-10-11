---
name: docs-writing
description:
  Prose rules for everything committed to the repo — docs/, READMEs, AGENTS.md and agents/ partials,
  and doc comments — plus the README and docs/ contracts and the scripts that check them. Use when
  writing, editing, or reviewing any repo prose.
---

# Docs writing

Write every sentence as if it had always existed, for a reader who saw none of the work that
produced it.

This skill is the shared base that repo-sync delivers from zgeoff/tools; edit it there, never here.
When the repo has a `project-docs-writing` skill, load it too: it holds the rules for this repo's
own docs tree, and where the two disagree, the project skill wins.

Two passes govern every doc. **Selection** decides which points the doc makes; it is ruthless.
**Rendering** decides how a surviving point is written — its sentences, its words, its shape, its
stance; it is generous. Shorten a doc by removing points, never by compressing the sentences that
state a surviving point. When a draft feels long, return to Selection — Rendering is never the
knife.

## Selection — which points the doc makes

- **Final state only.** Present tense, current behavior of the tree being edited. No history
  ("previously", "now uses"), no roadmap ("will land"), no temporary state ("not wired yet"), no
  references to the project's own issue tracker. A token that appears verbatim in code (a
  `baseline(#236)` marker) is a fact of the code, not a reference. An external upstream issue
  identifying a defect the tree works around (`turborepo#11007`) is a fact of the workaround, not
  tracking — it stays.
- **Shed process residue.** The work session leaves no trace in the doc. A date stamp in prose
  (`Verified 2026-05-26:`) rots — git history records when work happened; date-prefixed filenames
  and header metadata rows are structural and stay. Investigation framing ("Verified against…", "I
  checked…") belongs in the commit or PR body — state the finding itself. A citation of an agent's
  private memory file is a reference no other reader can resolve — cite the source file the memory
  points at, or omit.
- **Cut anything the reader could get from the code.** A point is a fact plus its rationale, however
  many sentences it takes to state. Cover the point; if a reader with the source file open would
  know and do everything the same, delete the whole point. This is the point test. This test judges
  whole points, never single sentences — a sentence that orients, names a referent, or summarizes is
  kept or cut on how it reads, not on whether it carries a point.
- **No defensive points.** A paragraph defending a decision against unlikely scenarios — enumerated
  edge cases requiring external tampering, "in case someone", scope-defending re-statements — is a
  point that fails the point test. A paragraph past 8 lines is the audit trigger: most ballooning is
  over-explaining decisions that don't need defending.
- **A bug fix rarely needs a doc change.** When a PR changes behavior, reread the doc that owns the
  behavior and rewrite the sentence the change made false. A new failure case, a tuned value, a
  renamed function, a new metric, or an operator procedure adds no paragraph: each lives in the
  code, in a registry the code defines, or in a runbook. A doc that grows a paragraph per fix turns
  into a changelog.
- **One owner per fact.** Each fact is explained in one place — its owner — across the whole docs
  tree, not just within one document. Any section that needs a fact it doesn't own states it in at
  most one sentence and links to the owner, and the rationale appears at the owner only. When two
  docs disagree, the owner is right: fix the other doc against it, then check the owner against the
  tree. An index restates owned facts at one line each — orientation is its job.
- **Don't copy what the code owns.** A copy of anything the code defines goes stale on the next
  change, with no signal. Describe it instead. Four kinds of copy recur: rosters, values, names, and
  code.
- **The tree owns its rosters.** A list, count, or mapping derivable from the repo — the packages
  under a directory, the apps in a manifest, which app reads which env key (its env schema) — is
  stated as the rule that derives it, never transcribed member by member. Name a member only where
  its behavior differs from the set's. A transcribed roster rots with no signal — it is wrong even
  while accurate. A mixed roster — part tree-derivable, part external — splits: the rule for the
  tree-held members, named bullets for the rest.
  - Bad: "The domain services — `service-activity`, `service-avatar`, `service-keys`,
    `service-session`, `service-user`, and `service-verification` — are private."
  - Good: "The domain services (every `services/*` app) are private."

  Two exemptions:
  - code blocks the reader executes
  - a derivable set keying a table whose other columns carry facts the tree does not hold — the
    roster is then the key, not the payload

- **The code owns its values.** A timeout, threshold, retry limit, schedule, cap, or byte length
  stays out of the doc; state the rule the value serves.
  - Bad: "`idle_timeout` (240 s) closes a pooled connection before Neon's 300 s suspend closes it."
  - Good: "An idle pooled connection closes before Neon's suspend closes it from the server side."

  A number belongs in a doc only when the code doesn't decide it: a period a protocol fixes, a cap a
  design defines, a count that is the point ("three classes"), or a measurement with its source. An
  architecture doc states even those as the rule they serve ("the keepalive period the protocol
  fixes"), and the guide or runbook that needs the number states it. `check-prose.sh` fails on a
  value with a unit under `docs/architecture/` outside code.

- **The code owns its names.** A function, option, column, env var, package name, or file path in
  prose breaks silently on a rename. Name the role instead: "the admission handler", "the database
  factory".
  - Bad: "`runBoundedAttempts` (`apps/web/src/lib/rpc/`) retries a GET up to three times."
  - Good: "The bounded-attempt policy resends a GET when an attempt hits its bound."

  Three kinds of identifier stay: an error code or wire field a client switches on, a domain term
  the doc defines that is also an identifier, and a command, key, or path the reader types.

- **Facts follow the reader's task.** A doc serves one reader task. A fact earns its place only if
  that reader acts on it mid-task; a fact serving a different task lives in that task's doc, linked
  from this one. The opening describes the subject, never who should read the doc or when to — no
  "read this when…", no "this doc is for…", no naming of the reader. A pass-through system (a deploy
  pipeline, config plumbing) documents its mechanism once and never the semantics of each value it
  carries — those belong to the owning feature's doc.

## The docs/ tree — which doc a point lives in

One architecture doc covers one subsystem, and one guide covers one user task. The repo has no total
line budget: the total follows from the doc list.

| Folder               | Holds                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `docs/README.md`     | the index                                                                 |
| `docs/architecture/` | the intended design and its constraints, one doc per subsystem            |
| `docs/guides/`       | the steps a user does, one doc per user task                              |
| `docs/runbooks/`     | operator and contributor procedures, development and releasing included   |
| `docs/reference/`    | generated reference only, such as the config JSON schema                  |
| `docs/decisions/`    | numbered decision records: the choice, the rejected alternatives, and why |
| `docs/design/`       | a design for big speculative work, opened by the owner and temporary      |

Group `docs/architecture/` in subfolders by area once it holds more than about 6 docs. The index
links `docs/reference/` once.

- **Architecture docs describe structure and invariants.** Structure is the parts, the boundaries
  between them, and which part owns each piece of state. An invariant is a rule that holds whatever
  a caller does: state it in at most three sentences (the rule, what it guarantees, one exception),
  with one `**Why:**` line. A walkthrough of a mechanism stays out, since the code shows it; so does
  a defense of a decision.
- **A doc may contain** the intended design, design constraints and invariants, facts that cross
  files and are invisible from reading one file, user reference for what a user touches (keys,
  session states, commands), and guides and runbooks for steps a user does.
- **A doc may not contain** reference for internals (one entry per protocol method, config key, or
  module), a walkthrough of a mechanism the code shows, or values and names the code owns.
  Evaluations, research write-ups, plans, diagnoses, and history stay out of `docs/` outside
  `docs/design/`. A finding that is still a constraint becomes one line in the architecture doc; the
  rest goes to the issue tracker or is deleted.
- **The code owns its reference.** Config keys, flags, and MCP tools are described in the code: the
  config schema (one `.describe()` per key, generated into `docs/reference/`), `--help`, and the
  tool descriptions. A configuration guide covers where config lives, worked examples, and a link to
  the schema.
- **A doc stays under 250 lines; a runbook under 300.** Past the cap, cut points first, then split
  at a real code boundary. When the doc is still over, say so in the PR body. Never compress
  sentences, never move the overflow into a README or code comments, and never split where the code
  has no boundary. `check-length.sh` warns on a doc over its cap.
- **A design lives in `docs/design/<work>/`** while its code is unbuilt, with any spikes as runnable
  packages in `docs/design/<work>/spikes/<name>/`. A plan for work about to be built is no design:
  it lives in its issue or PR. When the work lands, the built part moves into `docs/architecture/`
  and the design folder is deleted.
- **A decision record is permanent.** It states the choice, never how the system works now; the
  architecture doc owns that. A changed decision gets a new record that supersedes the old one.
- **Development and releasing live in runbooks.** `docs/runbooks/development.md` holds the
  contributor setup; `docs/runbooks/releasing.md` holds only the steps the release tooling doesn't
  do, and is deleted when none remain. A folder README that documents its own folder stays beside
  it.

## READMEs — the pitch, the install, and the capabilities

A README reader wants three things, in order: the pitch, the install, and the capabilities with
their configuration. Everything else lives in a guide in `docs/`, in `--help`, or in the config
schema.

A package README (one for a published package, classified as the table below states) has six
sections, in this order:

1. Hero: the logo or title, badges, and at most 3 links.
2. Pitch: 1 to 2 short paragraphs and the demo, when one exists. The pitch names the 2 or 3 actions
   that get a first session working.
3. Install: one command and its prerequisites. Other install paths link to a guide.
4. Capabilities: one section per capability axis, such as "Supported agents" (one line per agent)
   and "Features" (a short list, one line and one link per feature).
5. Configuration: one paragraph and a link.
6. Documentation: one line linking `docs/`.

A plain repo README (a repo that publishes no package) has one paragraph, then Quick start, Checks,
Layout, and Documentation. A sub-package or folder README documents its own folder.

`check-length.sh` classifies each README outside `docs/` and `.claude/`, and fails the run above its
limit:

| README      | Classified by                                                | Target | Limit |
| ----------- | ------------------------------------------------------------ | ------ | ----- |
| Package     | a package.json beside it that is not private, or `--package` | 120    | 130   |
| Plain repo  | the root README of a repo that isn't a package               | 50     | 60    |
| Sub-package | any other README outside `docs/`                             | 60     | 70    |

A README never holds flags, exit codes, config keys, per-agent or per-platform install variants,
edge cases inside table rows, key or state tables, dated "checked" stamps, or person names. A
feature PR rewrites only a README sentence the feature made false. A PR that adds a README sentence
is a README PR, and the repo owner reviews it.

## Sentences — how a surviving point reads

- **One fact per sentence; two only when inseparable.** Two facts are inseparable only when one is
  the other's direct consequence — "the tag derives from the commit, so no ref travels between jobs"
  is one fact. A sentence carrying two em-dash asides, or an em-dash aside plus a parenthetical
  gloss, splits at the first dash.
  - Bad: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>` — both phases
    derive the tag from the commit, so no ref travels between jobs — and re-running a leg overwrites
    its own tag."
  - Good: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>`. Both phases
    derive the tag from the commit, so no ref travels between jobs. Re-running a leg overwrites its
    own tag."
- **Topic sentence first.** A paragraph's first sentence states its single point; every later
  sentence supports that point, and a sentence starting a new point starts a new paragraph. The
  test: reading only first sentences yields a correct coarse version of the doc.
- **Lead with the fact.** The answer first, framing never — "Reuses the existing bucket", not "What
  we want to do here is…".
- **Show the rule in an instance.** When one concrete example illustrates a general rule, lead with
  the example: "a request to `/admin/api/2026-07/graphql.json` is intercepted even though the schema
  is pinned to `2026-01`" beats "handlers match any version segment and answer from the pinned
  schema". State the abstraction only when no single instance can illustrate it.
- **Active over passive.** "The sweep drops each stranded machine and records the set removed", not
  "stranded machines are dropped and the removed set is recorded". The test: append "by monkeys" — a
  sentence that still parses is passive.
- **Address the reader in how-to prose.** Instructions say "you" and use imperatives ("seed it
  yourself", "call `seed()`"). A how-to written without a reader reads as a spec. Declarative voice
  stays for reference and design prose, where the doc states what the system is rather than what the
  reader does. Choose voice per section, not per sentence, and hold the choice through it.
- **Actions are not definitions.** "A schema review is a rewrite" hides "when you review a schema,
  you rewrite it". A chain of abstract nouns with nobody in it ("the escalation path for consumers
  on diverging versions") stays opaque however precise it is; rewrite it as a clause with a subject
  and a verb ("who to call when a client is on an older version than the server").
- **No agentless artifact-subjects.** A sentence whose subject is a category of artifact and whose
  verb hands it a property ("a change you can see gets a screenshot") has no actor, and the missing
  actor is the defect. To pick the rewrite, open the sentence with an imperative verb: when the
  meaning survives, the imperative is the sentence ("Record a clip for any feature with an App
  release note"); when it doesn't, the sentence describes the system, so name the acting component
  ("`latest` returns `NotFoundException`", never "a model with no completed run gets
  `NotFoundException`"). A state description with no actor to name ("the field is optional") passes
  as written. Re-voice a failing section by redrafting it from its facts — patching verbs one by one
  preserves the spec voice.
- **Decisions read as decisions.** A made call never reads "may", "should", or "might" — hedged
  modals mark genuinely open options only. A conditional that defines criteria ("a change may be
  treated as standard-risk when…") is a definition, not a hedge.
- **Rule, then exception.** An exception takes its own sentence, placed after the rule's sentence —
  never a subordinate clause inside it. Two or more exceptions become a list.
  - Bad: "A background report carries a fresh trace id, except that a request-triggered drain
    inherits the originating request's trace."
  - Good: "A background report carries a fresh trace id scoping that unit of work. One exception: a
    request-triggered fire-and-forget drain inherits the originating request's trace."
- **Name the referent.** A pronoun's referent lives in the same sentence or the one before it; any
  farther back, repeat the noun. Repeating a noun is never a defect; a re-read to resolve a pronoun
  is. The same rule covers definite nouns: where the doc has more than one cap, filter, or budget,
  the bare form ("the cap") is legal only after the qualified form ("the cardinality cap") earlier
  in the same paragraph.
- **Name the whole first.** When a noun names a part of something, name the whole the first time:
  "activity start", not "start"; "chain head", not "head".
- **First use defines.** Spell an acronym out where it first appears ("Content Security Policy
  (CSP)"); a term of art gets a one-line definition or a link to its owner.
- **Same term for the same thing.** Varying a term to dodge repetition ("the runner… the executor…
  the worker") makes the reader ask whether they differ. Elegant variation is a defect in technical
  prose.
- **Each mechanism gets its own verb.** Joining unlike things under one vague verb ("carries",
  "covers") makes them read as a matched pair sharing one mechanism, and the reader goes looking for
  it. Where two things attach or act differently, give each its own clause and verb: "the PR gets
  the `epic` label, and its description ends with an epic-link line", never "the PR carries the
  label as well as the line".
- **Qualify nominalized verbs.** A verb used as a noun ("a reveal", "the split", "an append") is a
  coinage: compound it with the noun it acts on ("checkpoint reveal", "partition split", "chain
  append") or restructure the sentence around the verb. Define the compound at first use. A
  nominalization that names a design concept is reserved for that concept — pick a different word
  for the everyday sense.
- **Negate the verb or object, never the subject.** "A drain never delivers entries out of order",
  not "no drain delivers entries out of order" — a negated subject garden-paths. Noun stacks
  garden-path too: three bare nouns in a row unstack. A reduced relative clause appended after a
  dash takes "that" or "which".
- **Attribution takes a verb.** Name the owning doc or component as the subject: "the overview
  covers the boundaries", never "the boundaries are the overview's". A possessive on a markdown link
  ("the [sweep](url)'s seven readers") garden-paths twice over — put the link in a prepositional
  phrase instead.
- **Parentheses hold identifiers, paths, and values.** Never a gloss restating the prose, and at
  most one parenthetical per sentence. A consequence is never parenthetical — render it as its own
  sentence or after a colon.

## Words — what to cut on sight

- **Throat-clearing.** Filler that adds no information — find and cull: "naturally", "organically",
  "cleanly", "honestly", "trivially", "just", "earns its complexity", "lays foundation for", "cheap
  insurance", "the right level". "Easy", "simple", and "quick" pressure the reader and read as
  marketing — describe the thing instead ("one command", "on by default"). `Mitigation:` as a label
  — drop the label, state the mitigation.
- **Adjective stacks.** Five adjectives deep on one noun reads as marketing copy. Rewrite
  fact-first.
  - Bad: "This work introduces continuations — session-scoped, chain-rooted, identity-bearing rows
    that resume an activity…"
  - Good: "A continuation is a row minted from a chain coordinate. The session that owns it resumes
    the activity through it."
- **Weasel words.** Vague qualifiers where a specific claim belongs: "significantly", "many",
  "often", "typically", "generally", "near-instant". State the figure and its source, or make the
  concrete claim the qualifier is dodging. "~28.7 KB gzipped on average over a 7-day window"
  survives review; "artifacts are small" doesn't. An unsupported superlative ("the worst failure a
  forecasting API has") is the same defect with the sign flipped.
- **Delta-framing.** "Also", "as well as", "in addition", "now", "still", "already", and "today"
  assert an addition or a change against a baseline. With the baseline stated in the same doc the
  framing is legal; with the baseline in the conversation, a prior draft, or the diff, the sentence
  documents the edit instead of the system — write the resulting state. "New" qualifying a component
  ("the new endpoint") is the word-scale form: it stales the moment the change merges, so write the
  component's name.
- **Repeated framing.** The same rhetorical move three times in a row: "X, not Y" (pick the
  strongest contrast, drop the rest); "no new A, no new B, no new C" (collapse to one line); "means"
  / "is the" as the spine of every sentence (vary).
- **Overused contrast.** An antithesis ("built, never parsed", "a value, not an axis") earns its
  place once, where the rejected alternative is one the reader would otherwise assume. Repeated
  through a doc, it turns every sentence into a rebuttal of an argument the reader never made. State
  the rule; a rejected alternative that needs recording goes in the decision record.
- **Generated-prose tells.** Patterns that mark prose as machine-drafted. Cut or rewrite on sight:
  - Summary-style transitions recapping the previous paragraph ("With this setup complete…", "Now
    that we've covered…"). Pivot straight to the next point.
  - Spec-sheet voice narrating features instead of stating facts ("provides", "is configurable",
    "offers a flexible way to").
  - Stop-start fragments splitting one dependent idea ("Previously this was manual. Now it's
    automatic. This saves time." — one sentence). A short sentence for emphasis is fine.
  - Personified artifacts performing human actions ("the token hands the browser a session"); state
    what the system does ("the browser fetches the session"). Errors and status codes are not actors
    either: "on the 400, the client refetches", never "the 400 refetches". The commonest form is a
    speech verb on a data artifact: a row, key, id, field, or endpoint does not `name`, `say`,
    `tell`, `answer`, `know`, `promise`, or `agree` — it holds, includes, returns, or matches.
  - Slogan sentences: a maxim in place of a rule ("denial is the default, and the write side makes
    it safe"). A maxim reads as authority and states nothing the reader can check. Write the rule
    with its actor and its condition.
  - Template framing not specific to this doc ("The question most teams face is…").
  - Rhetorical questions setting up the answer the next sentence gives ("So why not cache it?
    Because…"). State the point.
- **Review vocabulary stays in this skill.** "Owns", "selection", and "rendering" are review terms
  here; a committed doc "explains", "covers", or "documents" its topic.
- **Banned words.** The AGENTS.md banned-words list applies to all prose; fix a violation on sight.

## Structure — the shape points take

- **Summary before detail.** A doc opens with three to six plain sentences saying what the system
  does and the one distinction a reader most needs. A section of four or more paragraphs opens with
  one sentence naming its scope and the common case. A section beyond six paragraphs splits into
  subsections. Detail never precedes its orientation.
- **Bullets for parallel facts, prose for causal flow.** A paragraph enumerating parallel items is a
  list — break it. A list whose items narrate cause and effect is a paragraph — join it. Every item
  carries a fact beyond its name; an item that has none moves inline.
- **Tables carry multi-attribute variants.** Three or more values of one discriminator (states,
  tiers, modes), each carrying two or more attributes of its own, render as a table — never as a
  prose chain of contrasts. Variants carrying one attribute each render as bullets.
- **Atomic cells.** A table cell holds one atomic value — an identifier, a number, a short phrase. A
  cell holding a list, a full clause, or a reference to another row means the table is the wrong
  shape. Resolve in order: point at the tree file that owns the mapping; render as a nested list;
  re-cut the table's axes. A decision table's prose column — a discriminator plus its trade-off or
  when to reach for it — is the shape doing its job, not a mis-cut.
- **Diagrams for pipelines, state machines, and topologies.** A section whose subject is one of the
  three opens with one mermaid diagram of that shape; a rule, a contract, or a set of parallel facts
  gets none. The prose under the diagram holds only what the diagram can't show: the invariant on
  each edge, the owner of each state, the exception. The diagram uses the prose's names and adds no
  node, number, or identifier the prose doesn't use.
- **Procedures are numbered steps.** Actions the reader performs in order render as a numbered list,
  one action per step; a step needing its own explanation gets a sentence under the step, not a
  longer step. A fenced code block inside a step is indented to the step — indentation is layout,
  not a content change. A procedure states its expected outcome verbatim ("Expect: HTTP 202", exact
  error text), never "should succeed". A verification checklist with no inherent order renders as
  bullets. A sequence a system performs is narration, never dressed as reader instructions; where
  the order itself is the fact (a pipeline, a request lifecycle), it renders as numbered stages
  written declarative, not imperative.
- **A multi-paragraph bold-lead is a heading.** One paragraph of body keeps a bold-lead; a second
  paragraph or a fenced code block makes it a section — promote it. Repeated template labels
  (`**Scope**` / `**Risk**` across the phases of a plan) still count: each introduces a
  multi-paragraph block, so all of them promote. Two shapes stay: one-line inline markers
  (`**Why:**`, `**Depends on:** phase 1.`) and a catalogue's run of same-shape sibling entries,
  which would gain a heading per entry and no navigation. A surviving bold-lead is an imperative or
  a topic ("**Anchor format:**"), never a claim — a claim in bold reads as a slogan, and a run of
  them reads as a manifesto.
- **No label wrappers.** A bold label naming the body's role — `**Design**`, `**Details**`,
  `**Rationale**`, `**Overview**` — adds nothing: the body already is its design, detail, or
  rationale. Drop the wrapper; replace a per-section `**Rationale**` block with inline `**Why:**`
  markers at the specific decisions whose rationale isn't visible. A section heading naming a role
  instead of a topic (`## Overview`, `## Notes`) is the heading-scale form — fold its content into
  the doc's intro or name what the section actually covers.
- **No horizontal rules.** `---` between sections is a heading that lost its name — headings already
  divide the doc. Delete it; if the break felt necessary, the section below it wants a heading.

## Stance — how the doc regards its reader and itself

- **Subject, not document.** Text points at the subject, never at the document's own structure ("as
  noted above", "see below") and never at the session that produced it. Links to an owning section
  or another doc are pointers at the subject and stand.
- **No positional framing of text.** Never define text by its position among sibling text — "the
  second…", "another…", "also sanctioned", a table cell reading "the above + …". A contrast between
  two domain states ("a `pruned` row means expired; a missing row means unknown") is a fact about
  the domain, not positional framing, and stands.

## Formatting and links

- **Write paragraphs as single long lines.** oxfmt reflows prose on commit (`proseWrap: "always"`,
  100 columns); hand-wrapping creates churn. Code blocks are left untouched — alignment inside
  fences survives.
- **Every code block carries a language tag** (`bash`, `ts`; `text` for plain output). An untagged
  block renders flat on GitHub and hides what it is.
- **Link code, don't transcribe it.** A fenced block holds commands the reader runs or a short
  illustrative shape. Code that exists in the repo is linked, never transcribed — a transcribed
  block is a roster: it rots with no signal, and the source file is typechecked where the block is
  not.
- **Value, space, unit** (`64 KB`, `200 ms`, `30 s`). Numerals for counts ("8 deployments", not
  "eight").
- **Placeholders name their content** (`<task_list_id>`, `<service_id>`), never `xxx`, `ABC123`, or
  `<TOKEN>`.
- **Anchors are GitHub's kebab-case** (`### Atomic cells` → `#atomic-cells`; `&` and `/` collapse to
  extra hyphens). A cross-doc link goes via a path relative to the linking file.
- **Link a target once** where it first matters, then refer to the topic by name — linking the same
  target six times across one section is noise.
- **`§` is forbidden** — bare in prose and inside link text. Link the section by its title; the link
  itself makes the section nature clear.

## Review workflow

Before committing docs, review each file you touched in four passes. A review subagent runs the same
passes with this skill as its only reference.

1. Selection pass: cover each point and apply the point test; check each fact against its owner
   elsewhere in the tree, and each doc against the docs/ tree and README rules.
2. Rendering pass: reread each surviving paragraph against Sentences, Words, Structure, and Stance.
3. Run the scripted checks from the repo root; CI runs the same two commands:

   ```bash
   bash .claude/skills/docs-writing/scripts/check-length.sh
   bash .claude/skills/docs-writing/scripts/check-links.sh
   ```

   `check-length.sh` prints each README against its limit and each docs/ file over its cap, then
   runs `check-prose.sh` over the READMEs and the Markdown under `docs/`. It fails on a README over
   its limit or on a prose violation. Pass `--package <readme>` for a package README whose
   package.json is private. `check-links.sh` checks every relative link and anchor in the READMEs
   and `docs/` (outside `.claude/`), and fails on a broken one. Pass paths to check other Markdown.
   To check other prose, such as a skill or AGENTS.md, run `check-prose.sh <path>...` on it.

   `check-prose.sh` fails on process residue, greppable banned words, values with units under
   `docs/architecture/`, formatting violations, and untagged code fences. It then prints candidate
   matches (filler with term-of-art uses, speech verbs on data artifacts, delta-framing words,
   headings written as claims), which need judgment, not automatic fixing, and never fail the run.
   It skips this skill's own directory, which documents the forbidden patterns and contains them as
   examples.

4. Visual audit: walk each changed section's links and confirm every link's text still matches its
   target heading.

A review report is a list of findings followed by a verdict. Each finding is one line:

```text
path:line — rule — "the quoted text" — the proposed fix
```

The rule is the bold lead of the rule the finding breaks. The proposed fix is a rewritten sentence
or "delete". Group findings by pass, and end with `clean`, or `fail` and the count. A reviewer
proposes and never edits; the writer fixes each finding by rewriting from the facts.
