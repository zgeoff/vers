---
name: docs-writing
description:
  Prose rules for everything committed to the repo — docs/, READMEs, AGENTS.md, and skills. Use when
  writing, editing, or reviewing any repo prose.
---

# Docs writing

A cold reader reads repo prose: someone with none of the conversation, ticket, or diff that produced
it, who reads every sentence as if it had always existed. A sentence that needs that missing context
fails review however clean it reads to its author, because the author's own mental model resolves
every referent. Each rule states a greppable pattern, a line budget, or an exact form, so an agent
can execute it and a human can check it. Selection decides which points a doc makes, and Rendering
decides how a surviving point reads. A doc gets shorter by losing points, never by compressing the
sentences that state a surviving point. When a sentence or a doc fails a rule, redraft it from the
facts it holds rather than patching it, because a patch keeps the failed structure.

## Selection

Selection asks one question of every point: does the reader need it for the task this doc serves? A
point is a fact plus its rationale, however many sentences it takes.

### What a point is

A point survives when it states the present system, serves the reader's task, and defends nothing.

- **Final state only.** A doc states the present behavior of the code, in the present tense. It
  carries no history ("previously", "now uses"), no roadmap ("will land"), no temporary state ("not
  wired yet"), and no reference to the project's own issue tracker. 2 tokens stay because they are
  facts of the code: a marker that appears verbatim in code, such as a `baseline(#236)` comment, and
  an external upstream issue that names a defect the code works around, such as `turborepo#11007`.
- **No process residue.** The session that wrote the doc leaves no trace in it. A date stamp in
  prose rots. Git history records when the work happened. Investigation framing ("Verified
  against…", "I checked…") belongs in the commit body. The doc states the finding. A citation of an
  agent's private memory is a reference no reader can resolve, so the doc cites the file the memory
  pointed at or omits the claim. Date-prefixed filenames and header metadata rows are structure, not
  residue, and stay.
- **The point test.** Cover the point. If a reader with the file open would know and do everything
  the same without it, delete the whole point. The test judges whole points, never single sentences.
  A sentence that orients, names a referent, or summarizes stays or goes on how it reads.
- **No defensive points.** A paragraph that defends a decision against unlikely scenarios fails the
  point test: enumerated edge cases that need external tampering, "in case someone", a restatement
  of scope. Reread any paragraph past 8 lines for a decision nobody attacked.
- **A fix is not a point.** A PR that changes behavior rereads the owning doc's points and rewrites
  the point the change made false. It adds no point for a failure sub-case, a tuned value, a renamed
  function, a new metric, or an operator procedure. Those belong to the code, its registry, or a
  runbook. A doc that gains a paragraph per fix is a changelog.

### Where a fact lives

Each fact has one owning doc, chosen by the reader task it serves.

- **Architecture states structure and invariants.** A doc under `docs/architecture/` states how a
  subsystem is put together and the invariants a caller must obey. Structure is the subsystem's
  parts, their boundaries, and which part owns each piece of state. An invariant takes at most 3
  sentences: the rule, its consequence, and one exception where one exists. 4 things fail the point
  test there, each with another home:
  - a step-by-step narration of a mechanism, which the code shows
  - the reason for a decision, which the commit body holds
  - a defense of that decision, which has no home
  - what a player sees, which a design note under `docs/game-design/` holds

  A mechanism the design calls for but the code does not implement is design, and lives in a design
  note. Where the design shaped a built mechanism, the architecture doc links the design note in one
  sentence.

- **One reader task per doc.** A fact earns its place only if the doc's reader acts on it mid-task.
  The opening describes the subject and never the reader: no "read this when…", no "this doc is
  for…". A pass-through system, such as a deploy pipeline or config plumbing, documents its
  mechanism once and never the meaning of each value it carries, because the owning feature's doc
  holds those.
- **One owner per fact.** One doc explains each fact and its rationale, across the whole docs tree.
  A fact that serves a different reader task lives in that task's doc. A section that needs a fact
  it does not own states it in at most one sentence and links the owner. When two docs disagree, the
  owner is right: fix the other doc against it, then check the owner against the tree. An index
  restates owned facts at one line each, because orientation is its job.

### What the code owns

A fact the repo derives stays in the repo, and the doc states the rule that derives it.

- **The code owns its rosters.** The doc states a list, count, or mapping the repo derives as the
  rule that derives it, never member by member: the packages under a directory, the apps in a
  manifest, which app reads which env key. A transcribed roster rots with no signal, so it is wrong
  even while accurate. Name a member only where its behavior differs from the set's. A mixed roster
  splits: the rule for the code-held members, and a named bullet for each external one. 2 rosters
  stay: a fenced block the reader runs, and a derivable set that keys a table whose other columns
  hold facts the code does not.
  - Bad: "The domain services — `service-activity`, `service-avatar`, `service-keys`,
    `service-session`, `service-user`, and `service-verification` — are private."
  - Good: "The domain services (every `services/*` app) are private."
- **The code owns its constants.** A numeric config value never appears in a doc: a timeout, a
  threshold, a retry bound, a cadence, a cap, a byte length. The doc states the rule the value
  serves, because the number changes on the next tuning PR and the doc does not. A number stays only
  when the code does not decide it: a protocol-fixed period, a design cap a design note owns, a
  count that is the point itself ("three classes"), or a measured fact with its source. A bundle
  size and an observed latency are measured facts.
  - Bad: "`idle_timeout` (240s) closes a pooled connection before Neon's 300s suspend closes it."
  - Good: "An idle pooled connection closes before Neon's suspend closes it from the server side."
- **The code owns its identifiers.** A function, option, column, env-var, or package name, or a file
  path, is a reference that a rename strands, so prose names the role instead: "the admission
  handler", "the database factory". 3 kinds stay: an error code or wire field a client narrows on, a
  domain noun the doc defines that is also an identifier (the `Started` checkpoint, `userSeed`), and
  a command or path the reader types.
  - Bad: "`runBoundedAttempts` (`apps/web/src/lib/rpc/`) retries a GET up to three times."
  - Good: "The bounded-attempt policy resends a GET when an attempt hits its bound."
- **The code owns its source.** A fenced block holds a command the reader runs or a short
  illustrative snippet. A doc links code that exists in the repo and never transcribes it. A
  transcribed block is a roster that rots. The typechecker checks the source file and never the
  block.

## Rendering

A reviewer reads each surviving point 5 ways, in this order: as sentences, as words, as structure,
as stance, and as formatting and links.

### Sentences

A sentence carries one fact, names who does what, and uses one name for each thing.

#### Facts

- **One fact per sentence.** A fact and its direct consequence share a sentence: "the tag derives
  from the commit, so no ref travels between jobs". Any other pair splits. A sentence that carries
  two dash asides, or a dash aside plus a parenthetical gloss, splits at the first dash. A relative
  clause after a dash keeps its "that" or "which", because a reduced one reads as a second aside.
  - Bad: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>` — both phases
    derive the tag from the commit, so no ref travels between jobs — and re-running a leg overwrites
    its own tag."
  - Good: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>`. Both phases
    derive the tag from the commit, so no ref travels between jobs. Re-running a leg overwrites its
    own tag."
- **Topic sentence first.** A paragraph's first sentence states its one point, and every later
  sentence supports it. A sentence that starts a new point starts a new paragraph. The test: reading
  only first sentences yields a correct coarse version of the doc. An instance that carries the
  point passes the test.
- **Lead with the fact.** The answer comes first and framing never: "Reuses the existing bucket",
  not "What we want to do here is…". An orientation clause ("To detect a stale artifact, …") stays,
  because it tells the reader where they are before the fact arrives.
- **Show the rule in an instance.** When one concrete example carries a general rule, lead with the
  example: "the handler intercepts a request to `/admin/api/2026-07/graphql.json` and answers it
  from the `2026-01` schema" beats "handlers match any version segment and answer from the pinned
  schema". State the abstraction alone only when no single instance carries it.
- **Parentheses hold identifiers, paths, values, and examples.** Never a gloss that restates the
  prose, and at most one parenthetical per sentence. A consequence is never parenthetical: it takes
  its own sentence or follows a colon.

#### Actors

- **Name the actor.** "The sweep drops each stranded machine and records the set removed", not
  "stranded machines are dropped and the removed set is recorded". 3 forms hide the actor. The
  passive: append "by monkeys", and a sentence that still parses is passive. The disguised activity:
  a copular sentence whose subject is a verb someone performs ("a voice review is a redraft" hides
  "when you review voice, you redraft"). The personified artifact: a token that "hands" the browser
  a session, or a status code that "refetches", when the browser fetches and the client refetches. A
  sentence that states a state or a definition ("the field is optional", "a point is a fact plus its
  rationale") has no actor, and the copula is correct there. Attribution names the owner as the
  subject too: "the overview owns the boundaries", never "the boundaries are the overview's". A
  possessive on a markdown link ("the [sweep](url)'s 7 readers") reads as two nouns, so the link
  goes in a prepositional phrase.
- **One verb per mechanism.** A vague verb ("carries", "handles", "covers") joining unlike things
  makes them read as a matched pair with one mechanism, and the reader goes looking for it. Where
  two things act differently, give each its own clause and verb: "the worker drops the machine and
  records the removal", never "the worker handles the machine and the removal".
- **Decisions read as decisions.** A made call never reads "may", "should", or "might". A hedged
  modal marks an open option only. A conditional that defines criteria ("a change may be treated as
  standard-risk when…") is a definition, not a hedge.
- **Rule, then exception.** An exception takes its own sentence after the rule's sentence, never a
  subordinate clause inside it. 2 or more exceptions become a list.
  - Bad: "A background report carries a fresh trace id, except that a request-triggered drain
    inherits the originating request's trace."
  - Good: "A background report carries a fresh trace id scoping that unit of work. One exception: a
    request-triggered fire-and-forget drain inherits the originating request's trace."
- **Address the reader in how-to prose.** Instructions say "you" and use imperatives ("seed it
  yourself", "call `seed()` if you'd rather not create data per test"). A how-to written without a
  reader reads as a spec. Reference and design prose stay declarative, because there the doc states
  what the system is.

#### Nouns

- **Name the referent.** A pronoun's referent lives in the same sentence or the one before it; any
  farther back, repeat the noun. Repeating a noun is never a defect, and a re-read to resolve a
  pronoun is. The same rule applies to definite nouns: where the doc has more than one cap, filter,
  or budget, "the cap" is legal only after "the cardinality cap" appears earlier in the same
  paragraph. A part-noun, a noun for a part, record, or position of something, takes that something
  in the phrase at first use: `activity start`, not a bare `start`; `chain head`, not a bare `head`.
- **Define a term once and keep it.** The doc spells an acronym out where it first appears ("Content
  Security Policy (CSP)") and gives a term of art a one-line definition or a link to its owner. From
  then on the same term names the same thing. Varying a term to dodge repetition ("the runner… the
  executor… the worker") makes the reader ask whether they differ.
- **Qualify a nominalized verb.** A verb used as a noun ("a reveal", "the split", "an append") is a
  coinage. Compound it with the noun it acts on ("checkpoint reveal", "partition split", "chain
  append") and define the compound at first use, or restructure the sentence around the verb. A
  design concept keeps its nominalization, and the everyday sense takes a different word.
- **Unstack nouns.** 3 bare nouns in a row make the reader parse the sentence twice, so break the
  stack with a preposition. A chain of abstract nouns with nobody doing anything ("the escalation
  path for consumers on diverging versions") stays opaque however precise it is. Rewrite an
  abstract-noun chain as a clause with a subject and a verb ("a consuming repo needs a version the
  mock does not carry, so the escalation says who ships it").
- **Negate the verb or object, never the subject.** "A drain never delivers entries out of order",
  not "no drain delivers entries out of order". A negated subject reads as a claim about the subject
  until the verb arrives.

### Words

A word earns its place by adding information; the rules name the words that add none.

- **Filler.** Cut words that add no information: "naturally", "organically", "cleanly", "honestly",
  "trivially", "just", "earns its complexity", "lays foundation for", "cheap insurance", "the right
  level". "Easy", "simple", and "quick" pressure the reader, so describe the thing instead ("one
  command", "on by default"). Drop a label such as `Mitigation:` and state the mitigation.
- **Weasel words.** A vague qualifier stands where a specific claim belongs: "significantly",
  "many", "often", "typically", "generally", "near-instant". State the figure and its source, or
  make the concrete claim the qualifier dodges. "~28.7KB gzipped on average over a 7-day window"
  survives review; "artifacts are small" does not.
- **Adjective stacks.** 3 or more adjectives on one noun read as marketing copy. Rewrite fact-first.
  - Bad: "This work introduces continuations — session-scoped, chain-rooted, identity-bearing rows
    that resume an activity…"
  - Good: "A continuation is a row minted from a chain coordinate. The session that owns it resumes
    the activity through it."
- **Repeated framing.** Cut the same rhetorical move used 3 times in a row to one use:
  - "X, not Y" keeps the strongest contrast
  - "no new A, no new B, no new C" collapses to one line
  - where "means" or "is the" is the spine of every sentence, vary the verb
- **Generated-prose tells.** 5 patterns mark prose as machine-drafted. Cut or rewrite each:
  - a summary transition that recaps the previous paragraph ("With this setup complete…", "Now that
    we've covered…"); pivot straight to the next point
  - spec-sheet voice that narrates features instead of stating facts ("provides", "is configurable",
    "offers a flexible way to")
  - stop-start fragments that split one dependent idea ("Previously this was manual. Now it's
    automatic. This saves time."); a short sentence for emphasis is fine
  - template framing not specific to this doc ("The question most teams face is…")
  - a rhetorical question that sets up the next sentence's answer ("So why not cache it? Because…")
- **Delta-framing.** "Also", "as well as", "in addition", "now", and "still" assert an addition or a
  change against a baseline. With the baseline stated in the same doc the framing is legal. With the
  baseline in the conversation, a prior draft, or the diff, the sentence documents the edit instead
  of the system, so write the resulting state. "New" qualifying a component ("the new endpoint")
  stales the moment the change merges, so name the component.
- **Banned words.** The [AGENTS.md banned-words list](../../../AGENTS.md#banned-words) applies to
  all prose. Fix a violation.

### Structure

A doc's form follows its content: prose for flow, a list for parallel facts, a table for variants, a
diagram for a shape, numbered steps for a procedure.

- **Summary before detail.** A doc opens with 3 to 6 plain sentences that say what the system does
  and the one distinction a reader most needs. A section of 4 or more paragraphs opens with one
  sentence that names its scope and the common case. A section past 6 paragraphs splits into
  subsections. A bullet counts as a paragraph for these budgets.
- **Bullets for parallel facts, prose for causal flow.** A paragraph that enumerates parallel items
  is a list; break it. A list whose items narrate cause and effect is a paragraph; join it. Every
  item carries a fact beyond its name, and an item with none moves inline.
- **Tables hold multi-attribute variants.** 3 or more values of one discriminator (states, tiers,
  modes), each with 2 or more attributes of its own, render as a table, never as a prose chain of
  contrasts. Variants with one attribute each render as bullets. A cell holds one atomic value: an
  identifier, a number, a short phrase. A cell that holds a list, a full clause, or a reference to
  another row means the table is the wrong form. Try 3 fixes in order: point at the source file that
  owns the mapping, render a nested list, re-cut the axes. A decision table's prose column, a
  discriminator plus its trade-off, is the form doing its job.
- **A diagram opens a section whose subject is a shape.** A pipeline, a state machine, or a topology
  is a shape, and those 3 are the whole list. The section that owns the shape opens with one mermaid
  diagram of it, and the prose in that section states only what the diagram cannot: the invariant at
  each edge, the owner of each state, the exception. A diagram names the same actors and terms as
  its subsystem's glossary and the surrounding prose, so it adds no vocabulary and holds no node the
  prose does not name. A diagram shows no numeric constant, names no identifier the prose would not
  name, and draws no defensive case. A section whose subject is a rule, a contract, or a set of
  parallel facts takes no diagram.
- **Procedures are numbered steps.** Actions the reader performs in order render as a numbered list,
  one action per step. A step that needs explanation gets a sentence under the step, not a longer
  step. Indent a fenced block inside a step to the step. A procedure states its expected outcome
  verbatim ("Expect: HTTP 202", exact error text), never "should succeed". A checklist with no
  inherent order renders as bullets. A sequence the system performs is narration, never reader
  instructions. Where the order is the fact (a pipeline, a request lifecycle), the sequence renders
  as numbered stages written in the declarative mood.
- **A multi-paragraph bold lead is a heading.** A bold-lead paragraph that grows a second paragraph
  or a fenced block is a section, so promote it to a heading. Promote repeated template labels too
  (`**Scope**` / `**Risk**` across the phases of a plan). 2 bold forms stay: a one-line inline
  marker (`**Why:**`, `**Depends on:** phase 1.`) and a catalogue's run of same-form sibling
  entries, where a heading per entry adds no navigation.
- **No label wrappers.** A bold label or heading that names the body's role (`**Design**`,
  `**Rationale**`, `## Overview`, `## Notes`) adds nothing, because the body already is its design
  or rationale. Drop the wrapper and name what the section covers, or fold the section's content
  into the intro. A per-section `**Rationale**` block becomes inline `**Why:**` markers at the
  decisions whose rationale is not visible.
- **No horizontal rules.** A `---` between sections is a heading that lost its name. Delete it, and
  give the section it separated a heading.

### Stance

Text points at the subject, never at the document's own structure ("as noted above", "see below"). A
link to an owning section or another doc points at the subject and stands. Positional framing of
text is the same fault: "the second…", "another…", "also sanctioned", a table cell reading "the
above + …". A contrast between two domain states ("a `pruned` row means expired; a missing row means
unknown") is a fact about the domain and stands.

### Formatting and links

The formatter and GitHub decide how prose renders, and these rules keep the source in the form both
expect.

- **Write a paragraph as one line and let oxfmt wrap it.** oxfmt reflows prose on commit, so
  hand-wrapping creates churn. oxfmt leaves fenced blocks as written.
- **Every fenced block carries a language tag** (`bash`, `ts`; `text` for plain output). An untagged
  block renders flat on GitHub.
- **Units attach to their value** (`200ms`, `30s`, `64KB`).
- **Counts are numerals** ("8 deployments", not "eight").
- **Placeholders name their content** (`<task_list_id>`, `<service_id>`), never `xxx`, `ABC123`, or
  `<TOKEN>`.
- **Anchors are GitHub's.** GitHub lowercases the heading, drops its punctuation, and turns each
  space into a hyphen, so `## Game entropy & provenance` links as `#game-entropy--provenance`.
- **A cross-doc link uses a path relative to the linking file.**
- **Link a target once** where it first matters, then refer to the topic by name.
- **`§` is forbidden**, bare in prose and inside link text. Link the section by its title.

## Review workflow

A reviewer runs 4 passes over each touched file, in order, and reports what it finds. The writer
runs the passes before committing; a review subagent runs the same passes with this skill as its
only rubric.

1. Selection pass. List each section's points. Judge every point against the Selection rules, and
   check each fact against its owner elsewhere in the repo.
2. Rendering pass. Reread each surviving paragraph against Sentences, Words, Structure, Stance, and
   Formatting and links, in that order.
3. Scripted checks. Run from the repo root:

   ```bash
   bash .claude/skills/docs-writing/scripts/check-prose.sh <path>...
   ```

   The script greps the paths for process residue, greppable banned words, unit-bearing numbers
   under `docs/architecture/`, and untagged fences, and exits non-zero on any hit. It skips this
   skill's own directory, whose examples carry the forbidden patterns on purpose. A reviewer of this
   skill judges those hits by hand.

4. Link audit. Walk each changed section's links and confirm every link's text matches its target
   heading.

### Report form

A review report is a list of findings followed by a verdict. Each finding is one line of the form
`path:line — rule — "quoted text" — redraft`, where the rule is a bold lead from this skill or, for
a rule stated outside a bold lead, its section title, and the redraft is the sentence the reviewer
proposes or the deletion. The reviewer groups findings by pass, Selection first. The verdict is
`clean` only when the reviewer reports no finding, or `fail` with the count of findings. A reviewer
proposes and never edits: the writer applies each finding by redrafting from the facts, not by
pasting the proposed text.
