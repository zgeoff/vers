# Workflows

## build-feature

`build-feature.js` drives an agreed feature plan to a reviewed, CI-green PR: sonnet implements on a
worktree branch, opus reviews the diff before the PR opens, the PR is created (or an existing one
updated), haiku watches CI. Fix loops are bounded at 2 rounds per gate (review, CI).

Invoke:

```ts
Workflow({ name: 'build-feature', args: { plan, branch, issue?, prNumber?, verifyCommands? } })
```

- The plan is agreed interactively first. A run cannot pause for conversation, so bake every
  decision the run will need into the plan, or split multi-decision phases into separate runs with
  conversation between.
- `prNumber` pushes to and readies an existing PR instead of creating one.
- `verifyCommands` adds full-graph gates for cross-cutting work (hooks only cover affected scopes).
- A result can carry `rebaseConflicts: true`, meaning a hand-resolved rebase whose hunks want human
  review rather than a re-run of the review pass, and `minorFindings` for human judgment.

### Orchestration model

- Model tiers: sonnet implements, haiku does discovery and CI watching, opus reviews. The review
  pass runs before the PR opens, not after.
- One issue = one worktree branch = one PR. Two big-diff PRs run sequentially, never in parallel —
  concurrent runs mean repeated rebases as main moves.
- Implementor briefs must pre-authorize mid-run redirects: state up front that follow-up
  instructions arrive as injected messages referencing the brief's item numbers and are authentic.
  Without this, agents can treat a legitimate redirect as prompt injection and silently ignore it.

### Gotchas

- Resume never carries the original `args` — re-pass the full `args` object on every resume, or the
  script dies at its arg check immediately.
- A stage that completed with a blocked or failed result replays that result from cache on resume.
  To re-run it after fixing the blocker, change its prompt (e.g. prepend a status update to the
  plan).
- Name-launched workflow scripts resolve from a session-start snapshot — use `scriptPath` to run
  mid-session edits.
- Subagent shells have no TTY: with no cached gpg passphrase, every `git commit` fails with "gpg:
  signing failed: Operation cancelled" and the run blocks at its first commit. Preflight with
  `echo test | gpg --clearsign > /dev/null`; if that fails, run it in a real terminal to cache the
  passphrase.
- The permission classifier blocks `.github/workflows/*` edits from automated runs — a fix that
  needs a CI change ends the run `blocked` and needs explicit approval.
