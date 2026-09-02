# Orient

Build the state of play from GitHub alone before any other role. Every fact you need is one of these
reads, and nothing carries over from a previous session.

1. Milestones. Read the open milestones with the milestone query in `reference/board.md`. The
   lowest-numbered open `P` milestone is the current increment; its description carries the done
   test.
2. Recent merges. Fetch, then read the last 4 weeks of `origin/main`:

   ```bash
   git fetch -q origin main && git log --since='4 weeks ago' --format='%ad %s' --date=short origin/main
   ```

   A tail of docs and renames marks a finished increment; a tail of features marks an active one.

3. Open issues. Run the issue query, which returns milestone, labels, blockers, blocked issues,
   linked PRs, and body length per issue.
4. Board items. Run the board query, which returns Status per issue.
5. Open PRs. `gh pr list --json number,title,headRefName,updatedAt` shows what build agents have in
   flight.

6. Main CI. The latest run of the `main` workflow on `main` is an interrupt when it is red:

   ```bash
   gh run list --branch main --workflow main.yml --limit 1 --json conclusion,headSha,url
   ```

Print the state-of-play block from `reference/state-of-play.md` down to the Stale line, then
continue to Reconcile. Reconcile, Triage, and Sequence change these numbers, and Report prints the
corrected block in full.
