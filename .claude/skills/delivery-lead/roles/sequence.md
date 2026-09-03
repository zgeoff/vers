# Sequence

Keep the blocked-by graph true and the Ready column current across every open increment and the side
lane. No increment waits on another: an issue is Ready the moment its own blockers close.

1. Edges. For each open issue in an open increment or the side lane, check that every dependency its
   body names has an edge, and add the missing ones. Propose removing an edge the body contradicts.
2. Critical path. For each open issue in an open increment or the side lane, count the open issues
   it transitively blocks. The chain from the issue with the highest count is the critical path, and
   it heads Report.
3. Ready. Set Ready on every open issue in an open increment, in the side lane, or an interrupt,
   whose blockers are all closed, which carries no `needs-refinement` label, and which has no open
   linked PR. An issue with an open linked PR keeps the In Review status Reconcile set. Set Backlog
   on a Ready issue that no longer qualifies.
4. Pick order. Interrupts first. Then sort the Ready issues of every open increment by blocked count
   descending, then increment number ascending, then issue number ascending. Report the top 5 with
   each one's increment.
5. Owner's chain. A blocked chain rooted in a side-lane issue waits on the owner, not on a build
   agent. Name the root in Report as theirs.
