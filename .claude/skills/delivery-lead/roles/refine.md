# Refine

Bring an issue to the shape a build agent picks up without asking. Run on ask, or on the issues
Report names as thin or stale. You rewrite the form and keep the author's scope; a scope change is a
proposal.

An issue is thin when its body is under 400 characters, lacks a template section, or names a file
path under Scope.

1. Read the issue, its blockers and the issues it blocks, the design notes under `docs/game-design/`
   it names, and the architecture doc for its area named in AGENTS.md.
2. Rewrite the body to its template under `.github/ISSUE_TEMPLATE/`: the lead paragraph, a Player
   story where a player perceives the outcome, Scope as outcomes, Approach (unverified) with what
   you did not check, and Notes with paths written as orientation on today's date.
3. Split when Scope carries two independent outcomes: propose the split, and cut the tickets on yes.
4. Merge when two issues name one outcome: propose the survivor.
5. Stale: an issue open and untouched for 90 days with no milestone. Refine it when it still reads
   true against the tree; otherwise propose closing it as not planned.
6. `needs-refinement`: apply the label when a decision only the owner can make blocks the scope, and
   write that one question as the first line of Notes. Remove the label once the body answers it.
7. Run the hygiene check and clear every finding:

   ```bash
   bun scripts/src/bin/issue-hygiene.ts <issue_number>
   ```
