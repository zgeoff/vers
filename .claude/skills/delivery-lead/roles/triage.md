# Triage

An issue is untriaged when it lacks an `area/*` label, a type label, a board item, or a board
Status. A filing agent prepares the labels and the body and stops there; the rest of this role is
yours. Triage every untriaged issue in the same cycle you find it.

1. Labels. One `area/*` label and one type label. The type set is the `TYPE_LABELS` list in
   `scripts/src/issue-hygiene/check-issue.ts`; `ux`, `security`, `easy win`, `tech-debt`, and
   `rebuild` are qualifiers, not types.
2. Milestone. An open increment only when its done test needs this issue; the side lane when the
   owner does the work by hand; otherwise none.
3. Edges. Add a blocked-by edge for every issue this one cannot start without. The body's Notes
   section names them ("follows", "depends on", "gated by").
4. Board. Add the issue with Status Backlog, or set Backlog on an item that arrived with no Status.
5. Hygiene. Run the check and clear every finding by editing the body, never by commenting:

   ```bash
   bun scripts/src/bin/issue-hygiene.ts <issue_number>
   ```

   A finding that needs a rewrite is Refine's work; do it in the same cycle when the issue is in an
   open increment.

6. Duplicate. Propose closing it and name the survivor.
7. Red `main` with no open issue naming the failure: cut a bug issue from the failing run (see Cut
   tickets), with the run URL and the failing step's exact output under Observed, labelled `bug` and
   its area, with no milestone. It is Ready as an interrupt.
