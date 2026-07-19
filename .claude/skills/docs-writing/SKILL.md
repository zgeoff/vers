---
name: docs-writing
description:
  Writing rules for repo prose — AGENTS.md and agents/ partials, docs/, README content, and doc
  comments. Load before writing or editing any of them.
---

# Docs writing

Write every sentence as if it had always existed, for a reader who saw none of the work that
produced it.

Two passes govern every doc. **Selection** decides which points the doc makes; it is ruthless.
**Rendering** decides how a surviving point is written — its sentences, its structure, its stance;
it is generous. Shorten a doc by removing points, never by compressing the sentences that state a
surviving point. When a draft feels long, return to Selection — Rendering is never the knife.

## Selection — which points the doc makes

- **Final state only.** Present tense, current behavior of the tree being edited. No history
  ("previously", "now uses"), no roadmap ("will land"), no temporary state ("not wired yet"), no
  references to the project's own issue tracker. A token that appears verbatim in code (a
  `baseline(#236)` marker) is a fact of the code, not a reference. An external upstream issue
  identifying a defect the tree works around (`turborepo#11007`) is a fact of the workaround, not
  tracking — it stays.
- **The point test.** A point is a fact plus its rationale, however many sentences it takes to
  state. Cover the point; if a reader with the file open would know and do everything the same,
  delete the whole point. This test judges whole points, never single sentences — a sentence that
  orients, names a referent, or summarizes is kept or cut on how it reads, not on whether it carries
  a point.
- **One owner per fact.** Each fact is explained in one place — its owner — across the whole docs
  tree, not just within one document. Any section that needs a fact it doesn't own states it in at
  most one sentence and links to the owner, and the rationale appears at the owner only. When two
  docs disagree, the owner is right: fix the other doc against it, then check the owner against the
  tree.
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

- **Facts follow the reader's task.** A doc serves one reader task, named in its opening. A fact
  earns its place only if the doc's reader acts on it mid-task; a fact serving a different task
  lives in that task's doc, linked from this one. A pass-through system (a deploy pipeline, config
  plumbing) documents its mechanism once and never the semantics of each value it carries — those
  belong to the owning feature's doc.

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
- **Decisions read as decisions.** A made call never reads "may", "should", or "might" — hedged
  modals mark genuinely open options only.
- **Rule, then exception.** An exception takes its own sentence, placed after the rule's sentence —
  never a subordinate clause inside it. Two or more exceptions become a list.
  - Bad: "A background report carries a fresh trace id, except that a request-triggered drain
    inherits the originating request's trace."
  - Good: "A background report carries a fresh trace id scoping that unit of work. One exception: a
    request-triggered fire-and-forget drain inherits the originating request's trace."
- **Name the referent.** A pronoun's referent lives in the same sentence or the one before it; any
  farther back, repeat the noun. Repeating a noun is never a defect; a re-read to resolve a pronoun
  is.
- **Parentheses hold identifiers, paths, and values.** Never a gloss restating the prose, and at
  most one parenthetical per sentence. A consequence is never parenthetical — render it as its own
  sentence or after a colon.

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
  re-cut the table's axes.
- **Procedures are numbered steps.** Actions the reader performs in order render as a numbered list,
  one action per step; a step needing its own explanation gets a sentence under the step, not a
  longer step. A fenced code block inside a step is indented to the step — indentation is layout,
  not a content change. A sequence a system performs is narration — render it as prose or
  subsections, never as numbered steps.
- **A multi-paragraph bold-lead is a heading.** It is dodging the outline — promote it. A one-line
  `**Topic.**` lead is fine.

## Stance — how the doc regards its reader and itself

- **Subject, not document.** Text points at the subject, never at the document's own structure ("as
  noted above", "see below") and never at the session that produced it. Links to an owning section
  or another doc are pointers at the subject and stand.
- **No positional framing of text.** Never define text by its position among sibling text — "the
  second…", "another…", "also sanctioned", a table cell reading "the above + …". A contrast between
  two domain states ("a `pruned` row means expired; a missing row means unknown") is a fact about
  the domain, not positional framing, and stands.
