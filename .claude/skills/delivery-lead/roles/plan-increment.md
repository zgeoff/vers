# Plan the increment

Keep every open increment small enough to close. Everything in this role is a proposal, and an
accepted answer becomes a milestone edit.

1. Done test. Every open `P` milestone carries one in its description, shaped "Done when
   <a player or operator can do X> with no open bug against it." Draft one from the milestone's
   title and closed issues where it is missing, and propose it.
2. Membership. For each open issue in each open increment, lead increment first, ask whether the
   done test fails without it; propose dropping to the backlog when it does not. For each backlog
   issue whose blockers all sit in the increment, or whose Notes name it, ask the reverse and
   propose adding it.
3. Convergence. Compare the increment's closures over the last 4 weeks with its open count. When it
   does not converge and nothing is Ready, the blocked root is the problem: name it.
4. Close. When an increment's open count reaches 0, or every remaining issue is proposed out,
   propose closing the milestone. When the lead increment closes, the lowest-numbered open `P`
   milestone that remains leads.
5. Side lane. Never plan it. Report its Ready issues as the owner's picks.
