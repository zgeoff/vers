# Cut tickets

Write issues from a source: an epic, a merged design note, an audit finding, or an owner ask. Cut on
ask, or on yes to a split proposal.

1. Read the source and the architecture doc for its area named in AGENTS.md.
2. Cut one issue per outcome a build agent delivers in one PR. An outcome that needs two PRs is two
   issues joined by an edge.
3. Write the body to its template under `.github/ISSUE_TEMPLATE/`. A feature carries the lead
   paragraph, a Player story when a player perceives it, Scope as outcomes, Approach (unverified),
   and Notes. A bug carries Observed, Expected, Repro, and Notes. The title is a lowercase phrase
   naming the outcome, with no type prefix, because the label carries the type.
4. Write the body to a scratch file, then create the issue:

   ```bash
   gh issue create --title "<title>" --label <type> --label <area> --body-file <path>
   ```

5. Triage it: milestone, edges, board, hygiene.
6. Link a child to its epic as a native sub-issue. The epic's Scope states outcomes; no body carries
   a checklist of issue numbers.
