# Report

Print the state-of-play block from `reference/state-of-play.md` in full as the last act of a cycle.
It is the only output the owner reads, so it stands alone.

- Convergence is each increment's open count against its closures over the last 4 weeks.
- Changed this cycle carries one line per class of edit Reconcile, Triage, and Sequence made.
- A decision line names the exact state edit and the reason, and the lines are numbered so "1 yes, 2
  no" is a complete answer. Print up to 5; the rest wait for the next cycle.
- Next names the one role to run next, or `waiting`.

Print nothing after the block. Never restate the model, and give a number only where it changes what
the owner does.
