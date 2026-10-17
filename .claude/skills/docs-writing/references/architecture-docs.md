# Architecture docs

An architecture doc gives the reader a working model of one subsystem before they change it. The
[docs-writing skill](../SKILL.md) rules on what to include and how to write apply throughout.

- [What an architecture doc is for](#what-an-architecture-doc-is-for)
- [Open with the concept, not the package](#open-with-the-concept-not-the-package)
- [Describe the mechanism where the mechanism is the architecture](#describe-the-mechanism-where-the-mechanism-is-the-architecture)
- [Give the reason in the sentence that needs it](#give-the-reason-in-the-sentence-that-needs-it)
- [Shape the doc set around concepts](#shape-the-doc-set-around-concepts)
- [What stays out of an architecture doc](#what-stays-out-of-an-architecture-doc)

## What an architecture doc is for

A reader opens an architecture doc before they change a subsystem, and should leave with a working
model of it: what it is for, what its parts are, how they fit together, which part owns each piece
of state, what must stay true whatever a caller does, and why the system has this shape. The test of
a good one: after reading it, the reader can predict what the system does in a case the doc never
names, such as what happens when a process dies halfway through a write. Everything else in this
section serves that model.

## Open with the concept, not the package

The first sentences say what the subsystem does, in the domain's own terms. The package that
implements it comes later and in passing, if at all.

- Bad: "`libs/seed-chain` holds the chain row, the two anchors, and the draw function."
- Good: "Every activity an avatar runs at a node draws its randomness from one place: that node's
  seed chain. The chain is a single sequence of positions running forward. An activity draws the
  position at the front, plays out from it, and leaves the next position for the activity that
  follows."

## Describe the mechanism where the mechanism is the architecture

Some mechanisms are the design: how queued work gets delivered when no worker stays resident, how a
connection pool recovers after the machine was frozen, how two anchors on a chain move and when one
is pulled back. Describe those, as a sequence of cause and effect, because the reader can't change
the subsystem safely without them.

A mechanism belongs in the doc when understanding it needs more than one file, or when the reason
for it isn't visible in the code. A step-by-step narration of one function stays out: the reader can
open the function.

## Give the reason in the sentence that needs it

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

## Shape the doc set around concepts

- **The architecture overview comes first.** `docs/architecture/overview.md` gives the whole system
  on one page: the path a request takes end to end, the topology (which processes and deployments
  exist and how they reach each other), the data (each store and the shapes of data it holds), and
  the cross-cutting concerns, each in a paragraph with a link to the doc that covers it. It differs
  from a product overview, which says what the product is and who it's for.
- **One doc per concept, not per package.** A concept can span several packages, and a package can
  hold parts of several concepts. Split a doc at a concept boundary, and split early when a concept
  is going to grow, rather than letting one doc absorb two.
- **Each doc points at its neighbours.** Near the top, a doc says in one sentence each which other
  docs cover the facts next to its own:
  `[Replay verification](./replay-verification.md) covers the verifier that proves a stream and settles it.`
  A link inside the opening paragraph does the same job, when its sentence says what the linked doc
  covers.
- **Diagrams carry the shapes.** The overview's request path and topology get diagrams, under the
  rules in
  [Diagrams for pipelines, state machines, and topologies](../SKILL.md#diagrams-for-pipelines-state-machines-and-topologies).

## What stays out of an architecture doc

- Design the code doesn't implement yet. It lives under `docs/design/`, and where a design shaped
  something that is built, the architecture doc links it in one sentence. In a system that is still
  being built, the overview describes the connections that exist, and one sentence links the design
  for the rest.
- What a user sees and does. A guide covers that.
- The alternatives a decision rejected. A decision record covers those.
- Reference for internals: one entry per protocol method, config key, or module.
