# Don't copy what the code owns

Anything the code defines, describe rather than copy. A copy goes stale the next time someone
changes the code, and nothing tells you. This covers four things.

**Lists.** If the repo already defines a list, such as the packages under a directory, the apps in a
manifest, or the env keys a service reads, describe how the list is defined instead of writing it
out.

- Bad: "The domain services — `service-cart`, `service-catalog`, `service-checkout`,
  `service-invoice`, `service-refund`, and `service-shipping` — are private."
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
number states it. `chex prose` fails on a value with a unit under `docs/architecture/` outside code.

**Names.** Don't refer to something by its function name, option name, column, env var, or file
path. A rename breaks the reference silently. Name the role instead: "the admission handler", "the
database factory".

- Bad: "`resendOnTimeout` (`src/client/retry/`) retries a GET up to three times."
- Good: "The retry policy resends a GET when an attempt times out."

A library, product, protocol, or algorithm the system is built from keeps its real name: pg-boss,
Neon, SQLite's WAL mode, Ed25519. Replacing one is an architecture change, so a refactor never
breaks the name. A workspace package's name may appear once, in passing, where the reader needs to
find the code.

Three kinds of identifier are fine too: an error code or wire field a client switches on, a domain
term the doc defines that also happens to be an identifier (the `Pending` order state, `cartToken`),
and a command, key, or path the reader types. The name of an outside resource that the reader types
into another tool, such as a database branch or an MCP source, counts as a key the reader types.

**Code.** A code block holds a command the reader runs or a short made-up example. Code that exists
in the repo gets a link, not a copy. The typechecker checks the source file, not your copy of it.
