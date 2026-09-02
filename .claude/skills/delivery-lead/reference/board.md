# Board reference

GitHub Project v2 at https://github.com/users/zgeoff/projects/2 (owner `zgeoff`, project number 2)
for the repo `zgeoff/vers`. The default `GH_TOKEN` cannot modify a user-level project, so run every
board read and mutation with `GH_TOKEN="$GH_TOKEN_PROJECTS" gh api graphql …`. Issue, milestone, and
repo operations stay on the default token.

## Identifiers

- Project node: `PVT_kwHOAC38l84BcdFe`
- Status field: `PVTSSF_lAHOAC38l84BcdFezhXFxrE`
- Status options: Backlog `d365fed3`, Ready `d2771956`, In Progress `33ae3e19`, In Review
  `2b4c9afb`, Done `124de6f4`
- Side lane: the `GD · Game design` milestone

## Queries

Open milestones with their done tests:

```bash
gh api "repos/zgeoff/vers/milestones?state=open&per_page=100" --jq '.[] | "\(.number)\t\(.title)\topen=\(.open_issues)\t\(.description)"'
```

Open issues with milestone, labels, blockers, blocked issues, linked PRs, update time, and body
length. The pagination variable must be named `endCursor`:

```bash
gh api graphql --paginate -f query='query($endCursor:String){ repository(owner:"zgeoff",name:"vers"){ issues(first:100,states:OPEN,after:$endCursor){ pageInfo{hasNextPage endCursor} nodes{ number title updatedAt milestone{title} labels(first:20){nodes{name}} blockedBy(first:20){nodes{number state}} blocking(first:50){nodes{number state}} closedByPullRequestsReferences(first:5){nodes{number state}} parent{number} body } } } }' --jq '.data.repository.issues.nodes[] | {number, title, updatedAt, milestone: .milestone.title, labels: [.labels.nodes[].name], blockedBy: [.blockedBy.nodes[] | select(.state=="OPEN") | .number], blocking: [.blocking.nodes[] | select(.state=="OPEN") | .number], prs: [.closedByPullRequestsReferences.nodes[] | select(.state=="OPEN") | .number], parent: .parent.number, bodyLength: (.body|length)}'
```

Board items with Status per issue:

```bash
GH_TOKEN="$GH_TOKEN_PROJECTS" gh api graphql --paginate -f query='query($endCursor:String){ node(id:"PVT_kwHOAC38l84BcdFe"){ ... on ProjectV2 { items(first:100,after:$endCursor){ pageInfo{hasNextPage endCursor} nodes{ id fieldValues(first:20){nodes{ ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2FieldCommon{name}}} }} content{ ... on Issue{number state} } } } } } }' --jq '.data.node.items.nodes[] | select(.content.number != null) | {item: .id, number: .content.number, state: .content.state, status: ([.fieldValues.nodes[] | select(.field.name=="Status") | .name][0])}'
```

Node ids for mutations:

```bash
gh api graphql -f query='{ repository(owner:"zgeoff",name:"vers"){ issue(number:<issue_number>){ id projectItems(first:5){ nodes{ id project{ number } } } } } }'
```

## Mutations

Set Status (the item id comes from the board query or the node-id query, the option id from the list
above):

```bash
GH_TOKEN="$GH_TOKEN_PROJECTS" gh api graphql -f query='mutation{ updateProjectV2ItemFieldValue(input:{projectId:"PVT_kwHOAC38l84BcdFe", itemId:"<item_id>", fieldId:"PVTSSF_lAHOAC38l84BcdFezhXFxrE", value:{singleSelectOptionId:"<option_id>"}}){ projectV2Item{ id } } }'
```

Add an issue to the board:

```bash
GH_TOKEN="$GH_TOKEN_PROJECTS" gh api graphql -f query='mutation{ addProjectV2ItemById(input:{projectId:"PVT_kwHOAC38l84BcdFe", contentId:"<issue_node_id>"}){ item{ id } } }'
```

Block X on Y, and the reverse:

```bash
gh api graphql -f query='mutation{ addBlockedBy(input:{issueId:"<x_node_id>", blockingIssueId:"<y_node_id>"}){ issue{ number } } }'
gh api graphql -f query='mutation{ removeBlockedBy(input:{issueId:"<x_node_id>", blockingIssueId:"<y_node_id>"}){ issue{ number } } }'
```

Link a child to its epic, and detach it:

```bash
gh api graphql -f query='mutation{ addSubIssue(input:{issueId:"<epic_node_id>", subIssueId:"<child_node_id>"}){ subIssue{ number } } }'
gh api graphql -f query='mutation{ removeSubIssue(input:{issueId:"<epic_node_id>", subIssueId:"<child_node_id>"}){ subIssue{ number } } }'
```

Milestone edits:

```bash
gh issue edit <issue_number> --milestone "<milestone_title>"
gh issue edit <issue_number> --remove-milestone
gh api --method PATCH repos/zgeoff/vers/milestones/<milestone_number> -f description="<done_test>"
gh api --method PATCH repos/zgeoff/vers/milestones/<milestone_number> -f state=closed
```

Labels and bodies:

```bash
gh issue edit <issue_number> --add-label <label> --remove-label <label>
gh issue edit <issue_number> --body-file <path>
```
