---
name: docs-writing
description:
  How to write prose that gets committed to the repo — docs/, READMEs, AGENTS.md, skills, and doc
  comments — plus the README and docs/ contracts and the scripts that check them. Load it before
  writing, editing, or reviewing any of them.
---

# Writing docs

This guide is for anyone writing prose that gets committed to the repo. Write for someone who wasn't
there: they didn't see the conversation, the ticket, or the diff, and they will read your sentence
months from now as if it had always been there. If a sentence only makes sense with that context, it
fails, however clean it looks to you. As the author you already know what every word refers to, so
you can't feel this failure. Check for it on purpose.

Two questions govern every doc: what it should say, and how it should say it. The first is where you
cut. The second is where you spend words. A doc is made of points, and a point is a fact plus the
reason for it, however many sentences that takes. When a doc feels too long, remove whole points;
don't squeeze the sentences that state the points you keep. And when a sentence fails a rule here,
rewrite it from the facts rather than patching it word by word, because patching keeps the broken
shape.

Committed prose follows this guide, not the register of the session that writes it. An output style
or a terse chat register governs what you say to the person you're working with, and none of it
reaches a committed file: no clipped sentences, no numerals for every count, no instruction voice in
a description.

This guide is the shared base that repo-sync delivers from zgeoff/tools; edit it there, never in a
downstream repo. When the repo has a `project-docs-writing` skill, load it too. It holds the rules
for this repo's own docs tree, and where the two disagree, the project skill wins.

## Deciding what to include

### Describe the system as it is now

Write in the present tense about what the code does today. Leave out history ("previously", "now
uses"), plans ("will land"), temporary states ("not wired yet"), and links to the project's own
issue tracker. Two things that look like references are fine, because they're facts about the code:
a marker that appears verbatim in the source, like a `baseline(#236)` comment, and an upstream issue
the code works around, like `turborepo#11007`.

Don't leave traces of the work session either. Date stamps in prose go stale, and git already
records when things happened. "Verified against…" and "I checked…" belong in the commit message; in
the doc, state what you found. Never cite an agent's private memory file, because no one else can
open it. Cite the source it pointed at, or leave the claim out. Dated filenames and metadata rows in
a header are structure, not traces, and they stay.

The same rule applies at the word level. "Also", "as well as", "in addition", "now", "still",
"already", and "today" all describe a change from some earlier state. That's fine when the doc
itself describes the earlier state. When the earlier state is only in your head, the conversation,
or the diff, the sentence documents your edit instead of the system. Write the resulting state. "The
new endpoint" is stale the moment the change merges, so name the endpoint.

### Cut anything the reader could get from the code

For each point, ask: if a reader had the source file open and this paragraph didn't exist, would
they still know everything it says and act the same way? If yes, delete the whole point. Judge whole
points, not single sentences. Keep or cut a sentence that orients the reader, names something, or
summarizes on how it reads, not on whether it carries a fact.

The test is one source file, not the whole repo: a fact that shows only across several files stays
("Describe the mechanism where the mechanism is the architecture" covers which).

Paragraphs that defend a decision are the most common source of padding: lists of edge cases that
only happen if someone tampers with the system, "in case someone…", restatements of what is out of
scope. If a paragraph runs past about eight lines, reread it and ask whether it's defending a
decision nobody attacked.

### A bug fix rarely needs a doc change

When a PR changes behavior, reread the doc that owns that behavior and rewrite whichever sentence
the change made false. Don't add a paragraph for a new failure case, a tuned value, a renamed
function, a new metric, or an operator procedure. Those live in the code, in a registry the code
defines, or in a runbook. A doc that grows a paragraph per fix turns into a changelog.

### Give each doc one job and each fact one owner

A doc serves one reader doing one task. A fact belongs in it only if that reader needs it while
doing that task. A fact that serves a different task belongs in that task's doc, with a link from
this one. Open with what the subject is, not with who should read the doc or when: no "read this
when…", no "this doc is for…".

Explain each fact, with its reasoning, in exactly one doc across the whole tree. That doc is the
fact's owner. Any other section that needs the fact states it in one sentence and links to the
owner. When two docs disagree, the owner is right: fix the other doc, then check the owner against
the code. An index may restate owned facts at one line each, because that's what an index is for.

A table or a store with its own doc splits its facts by kind. The doc for the concept owns what the
rows mean and the rules that change them. The doc for the store owns how it stores them: its engine,
its connections, its migrations. A storage fact with no reason the reader needs, such as an index
the queries call for, stays in the migration.

A system that passes values through, like a deploy pipeline or config plumbing, documents its
mechanism once. What each value means belongs in the doc for the feature that owns the value.

### Don't copy what the code owns

Anything the code defines, describe rather than copy. A copy goes stale the next time someone
changes the code, and nothing tells you. This covers four things.

**Lists.** If the repo already defines a list, such as the packages under a directory, the apps in a
manifest, or the env keys a service reads, describe how the list is defined instead of writing it
out.

- Bad: "The domain services — `service-activity`, `service-avatar`, `service-keys`,
  `service-session`, `service-user`, and `service-verification` — are private."
- Good: "The domain services (every `services/*` app) are private."

Name an individual member only when it behaves differently from the rest. If a list is partly from
the code and partly external, describe the rule for the code-defined members and list the external
ones by name. Two kinds of list are fine to write out: commands the reader will run, and a table
where the list is the key column and the other columns hold facts that aren't in the code.

**Numbers.** Don't put a config value in a doc: a timeout, a threshold, a retry limit, a schedule, a
cap, a byte length. State the rule the number serves instead.

- Bad: "`idle_timeout` (240 s) closes a pooled connection before Neon's 300 s suspend closes it."
- Good: "An idle pooled connection closes before Neon's suspend closes it from the server side."

A number belongs in a doc only when the code doesn't decide it: a period fixed by a protocol, a cap
that a design defines, a count that is the point ("three classes"), or a measurement with its
source, like a bundle size or an observed latency. An architecture doc states even those as the rule
they serve ("the keepalive period the protocol fixes"), and the guide or runbook that needs the
number states it. `check-prose.sh` fails on a value with a unit under `docs/architecture/` outside
code.

**Names.** Don't refer to something by its function name, option name, column, env var, or file
path. A rename breaks the reference silently. Name the role instead: "the admission handler", "the
database factory".

- Bad: "`runBoundedAttempts` (`apps/web/src/lib/rpc/`) retries a GET up to three times."
- Good: "The bounded-attempt policy resends a GET when an attempt hits its bound."

A library, product, protocol, or algorithm the system is built from keeps its real name: pg-boss,
Neon, SQLite's WAL mode, Ed25519. Replacing one is an architecture change, so a refactor never
breaks the name. A workspace package's name may appear once, in passing, where the reader needs to
find the code.

Three kinds of identifier are fine too: an error code or wire field a client switches on, a domain
term the doc defines that also happens to be an identifier (the `Started` checkpoint, `userSeed`),
and a command, key, or path the reader types. The name of an outside resource that the reader types
into another tool, such as a database branch or an MCP source, counts as a key the reader types.

**Code.** A code block holds a command the reader runs or a short made-up example. Code that exists
in the repo gets a link, not a copy. The typechecker checks the source file, not your copy of it.

## Architecture docs

### What an architecture doc is for

A reader opens an architecture doc before they change a subsystem, and should leave with a working
model of it: what it is for, what its parts are, how they fit together, which part owns each piece
of state, what must stay true whatever a caller does, and why the system has this shape. The test of
a good one: after reading it, the reader can predict what the system does in a case the doc never
names, such as what happens when a process dies halfway through a write. Everything else in this
section serves that model.

### Open with the concept, not the package

The first sentences say what the subsystem does, in the domain's own terms. The package that
implements it comes later and in passing, if at all.

- Bad: "`libs/seed-chain` holds the chain row, the two anchors, and the draw function."
- Good: "Every activity an avatar runs at a node draws its randomness from one place: that node's
  seed chain. The chain is a single sequence of positions running forward. An activity draws the
  position at the front, plays out from it, and leaves the next position for the activity that
  follows."

### Describe the mechanism where the mechanism is the architecture

Some mechanisms are the design: how queued work gets delivered when no worker stays resident, how a
connection pool recovers after the machine was frozen, how two anchors on a chain move and when one
is pulled back. Describe those, as a sequence of cause and effect, because the reader can't change
the subsystem safely without them.

A mechanism belongs in the doc when understanding it needs more than one file, or when the reason
for it isn't visible in the code. A step-by-step narration of one function stays out: the reader can
open the function.

### Give the reason in the sentence that needs it

Most facts in an architecture doc have a reason, and the reason goes in the same sentence or the
next one, joined by "because", "so", or "therefore". That lets a paragraph build an argument: the
problem, its consequence, the response, and the limit on the response. A reason is why this shape
works or what breaks without it. The alternatives that were rejected, and the history of how the
shape was reached, belong in a decision record.

Keep the `**Why:**` marker for a single decision that stands apart from the paragraph around it. A
doc with a `**Why:**` on every paragraph has turned into a rule list: each fact stops, its reason
stops, and the connection between facts is lost.

- Bad:

  > The database factory detects a resume as a wall-clock gap. **Why:** timers don't run while the
  > machine is paused.
  >
  > The factory swaps in a fresh pool on a resume. **Why:** Neon may have closed the old sockets.
  >
  > The gap threshold stays above any synchronous stretch of work. **Why:** a long verification must
  > not reset its own queries.

- Good:

  > The pool's timeouts stop while the process is paused. Fly suspends an idle machine with its
  > memory snapshot, so the pool resumes holding the sockets it had, and Neon may have closed them
  > in the meantime. The database factory therefore detects a resume, as a wall-clock gap between
  > reads it takes on a timer, and swaps in a fresh pool for new queries. The gap threshold stays
  > above any synchronous stretch of work that blocks the event loop, so a long verification never
  > trips a reset that would destroy its own live queries.

State an invariant, a rule that holds whatever a caller does, in plain sentences inside the
paragraph about the part that keeps it, with its reason beside it.

### Shape the doc set around concepts

- **The architecture overview comes first.** `docs/architecture/overview.md` gives the whole system
  on one page: the path a request takes end to end, the topology (which processes and deployments
  exist and how they reach each other), the data (each store and the shapes of data it holds), and
  the cross-cutting concerns, each in a paragraph with a link to the doc that covers it. It differs
  from a product overview, which says what the product is and who it's for.
- **One doc per concept, not per package.** A concept can span several packages, and a package can
  hold parts of several concepts. Split a doc at a concept boundary, and split early when a concept
  is going to grow, rather than letting one doc absorb two.
- **Each doc points at its neighbours.** Near the top, a doc says in one sentence each which other
  docs cover the facts next to its own: "[Replay verification](./replay-verification.md) covers the
  verifier that proves a stream and settles it." A link inside the opening paragraph does the same
  job, when its sentence says what the linked doc covers.
- **Diagrams carry the shapes.** The overview's request path and topology get diagrams, under the
  rules in "Diagrams for pipelines, state machines, and topologies".

### What stays out of an architecture doc

- Design the code doesn't implement yet. It lives under `docs/design/`, and where a design shaped
  something that is built, the architecture doc links it in one sentence. In a system that is still
  being built, the overview describes the connections that exist, and one sentence links the design
  for the rest.
- What a user sees and does. A guide covers that.
- The alternatives a decision rejected. A decision record covers those.
- Reference for internals: one entry per protocol method, config key, or module.

## The docs/ tree

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
- **A decision record is permanent.** It states the choice, never how the system works now; the
  architecture doc owns that. A changed decision gets a new record that supersedes the old one.
- **Development and releasing live in runbooks.** `docs/runbooks/development.md` holds the
  contributor setup; `docs/runbooks/releasing.md` holds only the steps the release tooling doesn't
  do, and is deleted when none remain. A folder README that documents its own folder stays beside
  it.

## READMEs

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

## Writing the sentences

### One idea per sentence

Keep two ideas in one sentence only when the second follows directly from the first: "the tag
derives from the commit, so no ref travels between jobs". If a sentence has two dash asides, or a
dash aside plus a parenthetical, split it at the first dash.

- Bad: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>` — both phases
  derive the tag from the commit, so no ref travels between jobs — and re-running a leg overwrites
  its own tag."
- Good: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>`. Both phases
  derive the tag from the commit, so no ref travels between jobs. Re-running a leg overwrites its
  own tag."

One idea per sentence is not one clause per sentence. A cause and its effect, or a rule and its
reason, belong together, and splitting them into a run of short sentences reads as a list of
disconnected claims. Write full sentences, with their articles and connecting words.

If you put a relative clause after a dash, keep its "that" or "which". Without it, the clause reads
as a second aside.

Use parentheses for identifiers, values, and short examples. Never use one to restate the sentence
in other words, and never put more than one in a sentence. A consequence is not a parenthetical:
give it its own sentence or put it after a colon.

### Put the point first

Start each paragraph with the sentence that states its point, and make every later sentence support
it. When a sentence starts a new point, start a new paragraph. A quick test: read only the first
sentence of each paragraph. You should get a correct rough version of the doc.

Inside a sentence, lead with the answer: "Reuses the existing bucket", not "What we want to do here
is…". A short orienting clause is fine ("To detect a stale artifact, …"), because it tells the
reader where they are before the fact arrives.

When one concrete example carries a general rule, give the example first. "The handler intercepts a
request to `/admin/api/2026-07/graphql.json` and answers it from the `2026-01` schema" is better
than "handlers match any version segment and answer from the pinned schema". State the abstraction
on its own only when no single example can carry it.

### Say who does what

Name the actor. "The sweep drops each stranded machine and records which ones it removed", not
"stranded machines are dropped and the removed set is recorded". Five shapes hide the actor:

- The passive voice. Add "by monkeys" to the end of the sentence. If it still parses, it's passive.
- An action disguised as a definition. "A schema review is a rewrite" hides "when you review a
  schema, you rewrite it".
- An object doing a person's job. A token doesn't "hand" the browser a session; the browser fetches
  one. A 400 doesn't "refetch"; the client refetches on a 400. The commonest form is a speech verb
  on data: a row, key, id, field, or endpoint doesn't name, say, tell, answer, know, or promise
  anything. It holds, includes, returns, or matches.
- A category of artifact handed a property, with nobody acting: "a change you can see gets a
  screenshot". Try opening the sentence with an imperative verb. If the meaning survives, the
  imperative is the sentence ("Record a clip for any feature with a release note"). If it doesn't,
  the sentence describes the system, so name the component that acts.
- A chain of abstract nouns with nobody in it. "The escalation path for consumers on diverging
  versions" stays opaque however precise it is. Rewrite it as a clause with a subject and a verb:
  "who to call when a client is on an older version than the server".

Sentences that state a fact or a definition have no actor, and "is" is the right verb there: "the
field is optional".

When you say which doc or component owns something, make it the subject: "the overview owns the
boundaries", not "the boundaries are the overview's". Don't hang a possessive on a link ("the
[sweep](url)'s seven readers"); put the link in a prepositional phrase instead.

Give each mechanism its own verb. If you join two different things with one vague verb like
"handles", "carries", or "covers", they sound like one mechanism, and the reader goes looking for
it. "The worker drops the machine and records the removal", not "the worker handles the machine and
the removal".

### Don't hedge a decision

If something has been decided, don't write "may", "should", or "might". Save those for options that
are genuinely open. A conditional that defines a rule ("a change may be treated as standard-risk
when…") is a definition, not a hedge.

### State the rule, then the exception

Put an exception in its own sentence, after the rule. Don't fold it into the rule's sentence as a
clause. If there are two or more exceptions, list them.

- Bad: "A background report carries a fresh trace id, except that a request-triggered drain inherits
  the originating request's trace."
- Good: "A background report carries a fresh trace id for that unit of work. One exception: a
  request-triggered fire-and-forget drain inherits the originating request's trace."

### Make every reference easy to resolve

A pronoun's referent should be in the same sentence or the one before. Any farther back, repeat the
noun. Repeating a noun is never a fault; making the reader scroll back is.

The same goes for "the" plus a noun. If the doc mentions more than one kind of limit, "the limit" is
only clear once "the rate limit" has appeared earlier in the same paragraph.

When a noun names a part of something, name the whole thing the first time: "activity start", not
"start"; "chain head", not "head".

Point at the subject, not at the document. No "as noted above", no "see below", no "the second…", no
"another…". Links to the section or doc that owns a fact are fine; they point at the subject. A
contrast between two states of the system ("a `pruned` row means expired; a missing row means
unknown") is a fact about the system and is fine.

### Use one name for each thing

Spell out an acronym the first time it appears ("Content Security Policy (CSP)"). Give a term of art
a one-line definition or a link to where it's defined. Then keep using the same term. Switching
words to avoid repetition ("the runner… the executor… the worker") makes the reader wonder whether
those are three different things.

A verb turned into a noun ("a reveal", "the split", "an append") is a made-up term, so attach it to
what it acts on ("checkpoint reveal", "partition split", "chain append") and define it on first use.
Or restructure the sentence around the verb. If a made-up term names a design concept, keep it for
that concept and use a different word for the everyday sense.

### Avoid noun pile-ups and negated subjects

Three bare nouns in a row make the reader parse the sentence twice. Break the pile-up with a
preposition: "a bug in the token expiry check", not "the token expiry check bug".

Negate the verb or the object, never the subject. "A drain never delivers entries out of order", not
"no drain delivers entries out of order". A negated subject reads as a claim about the subject until
the verb arrives.

### Write how-to as instructions

In a how-to, address the reader as "you" and use imperatives: "seed it yourself", "call `seed()` if
you'd rather not create data per test". A how-to written without a reader reads like a spec.
Architecture, reference, and design docs stay declarative, because there you're describing what the
system is, not telling the reader what to do. Choose the voice per section, and hold it through the
section.

## Choosing words

### Cut filler and vague qualifiers

Cut words that add nothing: "naturally", "organically", "cleanly", "honestly", "trivially", "just",
"earns its complexity", "lays foundation for", "cheap insurance", "the right level". "Easy",
"simple", and "quick" sound like marketing, so describe the thing instead: "one command", "on by
default". Drop labels like `Mitigation:` and state the mitigation.

Replace vague qualifiers with claims. "Significantly", "many", "often", "typically", "generally",
"near-instant" stand where a real claim should be. Give the figure and its source, or make the
concrete claim the qualifier is dodging. "~28.7 KB gzipped on average over a 7-day window" survives
review; "artifacts are small" doesn't. An unsupported superlative ("the worst failure a forecasting
API has") is the same fault in the other direction.

### Don't stack adjectives

Three or more adjectives on one noun read as marketing copy. Lead with the fact instead.

- Bad: "This work introduces continuations — session-scoped, chain-rooted, identity-bearing rows
  that resume an activity…"
- Good: "A continuation is a row minted from a chain coordinate. The session that owns it resumes
  the activity through it."

### Don't repeat a rhetorical move

The same move three times in a row wears out. If you've written "X, not Y" three times, keep the
strongest contrast. If you've written "no new A, no new B, no new C" as a flourish, collapse it to
one line. A list of criteria inside one sentence is no flourish: "work that needs no durable
delivery, no retry, and no dead-letter trail does not belong on a queue" is a test the reader
applies, and it stays. If "means" or "is the" is the main verb of every sentence, vary the verbs.

A contrast ("built, never parsed", "a value, not an axis") earns its place once, where the reader
would otherwise assume the rejected alternative. Repeated through a doc, it turns every sentence
into a rebuttal of an argument nobody made. State the rule; a rejected alternative worth recording
goes in the decision record.

### Cut the tells of machine-drafted prose

These patterns mark text as generated. Cut or rewrite them:

- Transitions that recap the previous paragraph: "With this setup complete…", "Now that we've
  covered…". Go straight to the next point.
- Feature-list voice: "provides", "is configurable", "offers a flexible way to". State the fact.
- Choppy fragments that split one idea: "Previously this was manual. Now it's automatic. This saves
  time." Make it one sentence. A short sentence for emphasis is fine.
- Slogans in place of rules: "denial is the default, and the write side makes it safe". A maxim
  sounds authoritative and states nothing the reader can check. Write the rule with its actor and
  its condition. A short line that sums up a rule the doc states in full elsewhere is a summary, not
  a slogan: "play runs ahead of proof, and payment waits for proof" stays when a later section says
  which part pays and when.
- Framing that could open any doc: "The question most teams face is…".
- A rhetorical question that only sets up the next sentence: "So why not cache it? Because…". Say it
  directly.

### Banned words

`check-prose.sh` greps for the words every zgeoff repo bans, and a repo's AGENTS.md may ban more.
Fix any violation you see.

## Shaping the doc

### Summary first

Open a doc with a paragraph of three to six plain sentences that say what the system does and the
one thing a reader most needs to know. The text before the first heading may run to a few short
paragraphs when they lay out the core of the model, such as the two anchors of a chain, but never
into detail. Open any section of four or more paragraphs with a sentence that names what it covers
and the common case. Split a section that runs past six paragraphs into subsections. Bullets count
as paragraphs for these limits.

### Lists for parallel items, prose for cause and effect

If a paragraph enumerates parallel things, make it a list. If a list's items tell a cause-and-effect
story, make it a paragraph. A list whose items are parallel, each with its own cause and effect
inside it, such as three ways a queue gets drained, stays a list. Every list item should carry a
fact beyond its own name; an item with nothing to add goes inline.

Most of an architecture doc is cause and effect, so most of it is paragraphs.

### Tables for variants with several attributes

When you have three or more values of one kind (states, tiers, modes) and each has two or more
attributes, use a table. Don't write a chain of contrasting sentences. If each value has only one
attribute, use bullets.

Keep each cell to one value: an identifier, a number, a short phrase. If you find yourself putting a
list, a whole clause, or a reference to another row in a cell, the table is the wrong shape. Try
these in order: point to the source file that owns the mapping; use a nested list; re-cut the
table's columns. A decision table is the exception: its prose column says what each option is and
when to use it, and that's fine.

### Diagrams for pipelines, state machines, and topologies

If a section's subject is a pipeline, a state machine, or a topology, open it with one mermaid
diagram of that shape. Those three are the whole list; a section about a rule, a contract, or a set
of parallel facts gets no diagram. When the whole doc's subject is one of the three, the diagram
sits after the opening paragraphs, before the first heading. Under the diagram, write only what the
diagram can't show: the invariant on each edge, who owns each state, the exception.

Use the same names in the diagram that the surrounding prose and the glossary use. A diagram adds no
vocabulary and no nodes the prose doesn't mention. It carries no numbers from the code, no
identifiers the prose wouldn't use, and no defensive edge cases.

### Procedures as numbered steps

When the reader performs actions in order, write a numbered list with one action per step. If a step
needs explanation, add a sentence under it rather than making the step longer. Indent a code block
inside a step to the step. State the expected outcome exactly ("Expect: HTTP 202", the exact error
text), never "should succeed". A checklist with no inherent order is bullets.

A sequence the system performs is a description, not instructions to the reader. Where the order is
the point (a pipeline, a request lifecycle), write it as numbered stages in the declarative: "1. The
build job pushes the image", not "1. Push the image".

### Headings, bold leads, and rules

A bold lead-in works for a single paragraph. Once it needs a second paragraph or a code block, it's
a section, so give it a heading. This includes repeated template labels like `**Scope**` and
`**Risk**` across the phases of a plan. Two shapes stay bold: a one-line marker (`**Why:**`,
`**Depends on:** phase 1.`) and a run of entries that all have the same shape, like the entries in a
changelog, where a heading on each one would only add noise. A bold lead names a topic or gives an
instruction ("**Anchor format:**"), never a claim: a claim in bold reads as a slogan, and a run of
them reads as a manifesto.

Don't label a body with its own role. `**Design**`, `**Rationale**`, `## Overview`, and `## Notes`
add nothing, because the body already is the design or the rationale. Name what the section is
about, or fold it into the intro.

Don't use `---` between sections. A horizontal rule is a heading that lost its name. Delete it, and
if the break felt necessary, give the section under it a heading.

## Formatting and links

- Write each paragraph as one long line. oxfmt reflows prose on commit (`proseWrap: "always"`, 100
  columns), so hand-wrapping creates churn. Code blocks are left as written.
- Tag every code block with a language (`bash`, `ts`, or `text` for plain output). An untagged block
  renders flat on GitHub and hides what it is.
- Put a space between a value and its unit: `64 KB`, `200 ms`, `30 s`. Write measured counts as
  numerals: "8 deployments", not "eight". A count that is the point of the sentence reads as a word
  ("three classes", "two anchors").
- Name what a placeholder stands for: `<task_list_id>`, `<service_id>`. Never `xxx`, `ABC123`, or
  `<TOKEN>`.
- GitHub makes anchors by lowercasing the heading, dropping punctuation, and turning each space into
  a hyphen, so `## Game entropy & provenance` links as `#game-entropy--provenance`.
- Link to another doc with a path relative to the linking file.
- Link a target once, where it first matters, and refer to it by name after that.
- Never use `§`, in prose or in link text. Link the section by its title.

## Reviewing a doc

Before you commit, review each file you touched in four passes. A review subagent runs the same four
passes with this guide as its only reference.

1. What it says. List the points each section makes and judge each one against "Deciding what to
   include". Check every fact against the doc that owns it, and each doc against "The docs/ tree"
   and "READMEs". For an architecture doc, also run the model test: read only its first sentences
   and its diagrams, and check that they give a correct rough model; then pick a case the doc never
   names and check that the doc lets you predict what the system does.
2. How it says it. Reread each surviving paragraph against "Writing the sentences", "Choosing
   words", "Shaping the doc", and "Formatting and links", in that order.
3. The scripted checks. Run from the repo root; CI runs the same two commands:

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

   `check-prose.sh` fails on traces of the work session, the banned words a grep can catch, values
   with units under `docs/architecture/`, formatting faults, and untagged code blocks. It then
   prints candidates (filler words that have term-of-art uses, speech verbs on data, delta words,
   headings written as claims), which need judgment and never fail the run. It skips this skill's
   own directory, because the examples here contain those patterns on purpose. If you're reviewing
   this skill, run the greps by hand and judge the hits.

4. The links. Walk each changed section's links and confirm the link text still matches the heading
   it points to.

### What a review report looks like

A report is a list of findings followed by a verdict. Each finding is one line:

```text
path:line — rule — "the quoted text" — the proposed fix
```

The rule is the heading of the section the finding falls under. The proposed fix is a rewritten
sentence or "delete". Group findings by pass. End with `clean` if there are no findings, or `fail`
and the count. A reviewer proposes and never edits. The writer then fixes each finding by rewriting
from the facts, not by pasting the reviewer's sentence in.
