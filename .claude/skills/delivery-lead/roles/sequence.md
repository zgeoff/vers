# Sequence

Keep the blocked-by graph true and the Ready column current. Work on the current increment and the
side lane; higher increments wait.

1. Edges. For each open issue in the current increment, check that every dependency its body names
   has an edge, and add the missing ones. Propose removing an edge the body contradicts.
2. Critical path. For each open issue in the increment, count the open issues it transitively
   blocks. The chain from the issue with the highest count is the critical path, and it heads
   Report.
3. Ready. Set Ready on every open issue in the current increment, in the side lane, or an interrupt,
   whose blockers are all closed and which carries no `needs-refinement` label. Set Backlog on a
   Ready issue that no longer qualifies.
4. Pick order. Interrupts first. Then sort the Ready issues of the current increment by blocked
   count descending, then issue number ascending. Report the top 5.
5. Owner's chain. A blocked chain rooted in a side-lane issue waits on the owner, not on a build
   agent. Name the root in Report as theirs.
