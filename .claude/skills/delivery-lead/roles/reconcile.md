# Reconcile

Correct the board against issue and PR state. Every edit in this role is yours to make. Note each
class of edit as one line for Report ("set Done on 12 closed issues").

- A closed issue whose Status is not Done: set Done.
- An open issue with no board item, unless labelled `upkeep`, `dep-outdated`, or `dep-audit`: add it
  to the board with Status Backlog.
- An open issue whose board item has no Status and which has no open linked PR: set Backlog. The
  sub-issue automation adds items this way; an item with an open linked PR takes In Review under the
  next rule instead.
- An open issue with an open linked PR whose Status is not In Review: set In Review.
- An open issue in Status In Progress or In Review with no open linked PR: set Ready when it
  qualifies as Ready, else Backlog, and name it in Report as stalled. A side-lane issue is exempt:
  the owner works it by hand, so In Progress with no PR is its normal state.
- An epic (`epic` label) whose body lists issue numbers as a checklist: link the listed issues as
  native sub-issues, then rewrite the body's Scope as outcomes. The sub-issues carry the breakdown
  and their own state.
- A closed epic with open sub-issues: detach them and name them in Report.
- An open issue whose milestone is closed: propose the increment it belongs to, or the backlog.
