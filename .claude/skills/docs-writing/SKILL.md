---
name: docs-writing
description:
  Prose rules for everything committed to the repo — docs/, READMEs, AGENTS.md and agents/ partials,
  and doc comments. Use when writing, editing, or reviewing any repo prose.
---

# Docs writing

Write every sentence as if it had always existed, for a reader who saw none of the work that
produced it.

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
- **The point test.** A point is a fact plus its rationale, however many sentences it takes to
  state. Cover the point; if a reader with the file open would know and do everything the same,
  delete the whole point. This test judges whole points, never single sentences — a sentence that
  orients, names a referent, or summarizes is kept or cut on how it reads, not on whether it carries
  a point.
- **No defensive points.** A paragraph defending a decision against unlikely scenarios — enumerated
  edge cases requiring external tampering, "in case someone", scope-defending re-statements — is a
  point that fails the point test. A paragraph past 8 lines is the audit trigger: most ballooning is
  over-explaining decisions that don't need defending.
- **One owner per fact.** Each fact is explained in one place — its owner — across the whole docs
  tree, not just within one document. Any section that needs a fact it doesn't own states it in at
  most one sentence and links to the owner, and the rationale appears at the owner only. When two
  docs disagree, the owner is right: fix the other doc against it, then check the owner against the
  tree. An index restates owned facts at one line each — orientation is its job.
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

- **Facts follow the reader's task.** A doc serves one reader task. A fact earns its place only if
  that reader acts on it mid-task; a fact serving a different task lives in that task's doc, linked
  from this one. The opening describes the subject, never who should read the doc or when to — no
  "read this when…", no "this doc is for…", no naming of the reader. A pass-through system (a deploy
  pipeline, config plumbing) documents its mechanism once and never the semantics of each value it
  carries — those belong to the owning feature's doc.

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
- **Active over passive.** "The sweep drops each stranded machine and records the set removed", not
  "stranded machines are dropped and the removed set is recorded". The test: append "by monkeys" — a
  sentence that still parses is passive.
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
- **First use defines.** Spell an acronym out where it first appears ("Content Security Policy
  (CSP)"); a term of art gets a one-line definition or a link to its owner.
- **Same term for the same thing.** Varying a term to dodge repetition ("the runner… the executor…
  the worker") makes the reader ask whether they differ. Elegant variation is a defect in technical
  prose.
- **Qualify nominalized verbs.** A verb used as a noun ("a reveal", "the split", "an append") is a
  coinage: compound it with the noun it acts on ("checkpoint reveal", "partition split", "chain
  append") or restructure the sentence around the verb. Define the compound at first use. A
  nominalization that names a design concept is reserved for that concept — pick a different word
  for the everyday sense.
- **Negate the verb or object, never the subject.** "A drain never delivers entries out of order",
  not "no drain delivers entries out of order" — a negated subject garden-paths. Noun stacks
  garden-path too: three bare nouns in a row unstack. A reduced relative clause appended after a
  dash takes "that" or "which".
- **Attribution takes a verb.** Name the owning doc or component as the subject: "the overview owns
  the boundaries", never "the boundaries are the overview's". A possessive on a markdown link ("the
  [sweep](url)'s seven readers") garden-paths twice over — put the link in a prepositional phrase
  instead.
- **Parentheses hold identifiers, paths, and values.** Never a gloss restating the prose, and at
  most one parenthetical per sentence. A consequence is never parenthetical — render it as its own
  sentence or after a colon.

## Words — what to cut on sight

- **Throat-clearing.** Filler that adds no information — find and cull: "naturally", "organically",
  "cleanly", "honestly", "trivially", "earns its complexity", "lays foundation for", "cheap
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
  concrete claim the qualifier is dodging. "~28.7KB gzipped on average over a 7-day window" survives
  review; "artifacts are small" doesn't.
- **Repeated framing.** The same rhetorical move three times in a row: "X, not Y" (pick the
  strongest contrast, drop the rest); "no new A, no new B, no new C" (collapse to one line); "means"
  / "is the" as the spine of every sentence (vary).
- **Generated-prose tells.** Patterns that mark prose as machine-drafted. Cut or rewrite on sight:
  - Summary-style transitions recapping the previous paragraph ("With this setup complete…", "Now
    that we've covered…"). Pivot straight to the next point.
  - Spec-sheet voice narrating features instead of stating facts ("provides", "is configurable",
    "offers a flexible way to").
  - Stop-start fragments splitting one dependent idea ("Previously this was manual. Now it's
    automatic. This saves time." — one sentence). A short sentence for emphasis is fine.
  - Personified artifacts performing human actions ("the token hands the browser a session"); state
    what the system does ("the browser fetches the session"). Errors and status codes are not actors
    either: "on the 400, the client refetches", never "the 400 refetches".
  - Template framing not specific to this doc ("The question most teams face is…").
  - Rhetorical questions setting up the answer the next sentence gives ("So why not cache it?
    Because…"). State the point.
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
  which would gain a heading per entry and no navigation.
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
- **Units attach directly to their value** (`200ms`, `30s`, `64KB`). Numerals for counts ("8
  deployments", not "eight").
- **Placeholders name their content** (`<task_list_id>`, `<service_id>`), never `xxx`, `ABC123`, or
  `<TOKEN>`.
- **Anchors are GitHub's kebab-case** (`### Atomic cells` → `#atomic-cells`; `&` and `/` collapse to
  extra hyphens). A cross-doc link goes via a path relative to the linking file.
- **Link a target once** where it first matters, then refer to the topic by name — linking the same
  target six times across one section is noise.
- **`§` is forbidden** — bare in prose and inside link text. Link the section by its title; the link
  itself makes the section nature clear.

## Review workflow

Before committing docs, run this sequence over the files you touched:

1. Selection pass: cover each point and apply the point test; check each fact against its owner
   elsewhere in the tree.
2. Rendering pass: reread each surviving paragraph against Sentences, Words, Structure, and Stance.
3. Run the scripted checks from the repo root:

   ```bash
   bash .claude/skills/docs-writing/scripts/check-prose.sh <path>...
   ```

   The script greps the given paths for process residue, greppable banned words, and untagged code
   fences, and exits non-zero on any hit. It skips this skill's own directory, which documents the
   forbidden patterns and contains them as examples.

4. Visual audit: walk each changed section's links and confirm every link's text still matches its
   target heading.
