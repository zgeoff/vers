export const meta = {
  name: 'build-feature',
  description:
    'Implement an agreed feature plan: sonnet builds on a worktree branch, opus reviews the diff, a PR opens once clean, haiku watches CI, with bounded fix loops at each gate',
  whenToUse:
    'After a feature plan has been agreed interactively. Pass args: { plan: string, branch: string, issue?: number }. Returns the PR URL on success or a failure report with the branch left in place for inspection.',
  phases: [
    { title: 'Implement', detail: 'sonnet implements the plan in a worktree', model: 'sonnet' },
    {
      title: 'Review',
      detail: 'opus reviews the diff; sonnet fixes blocking findings (max 2 rounds)',
      model: 'opus',
    },
    { title: 'Open PR', detail: 'push the branch and open a PR with the template' },
    {
      title: 'Watch CI',
      detail: 'haiku watches checks; sonnet fixes red CI (max 2 rounds)',
      model: 'haiku',
    },
  ],
}

const MAX_FIX_ROUNDS = 2

if (!args || !args.plan || !args.branch) {
  throw new Error('build-feature requires args: { plan: string, branch: string, issue?: number }')
}

const { plan, branch, issue } = args
const worktree = `.worktrees/${branch}`

/**
 * Ground rules every agent that touches the repo must follow. Prepended to
 * each mutating prompt so fixer agents in later phases inherit the same
 * constraints as the implementer.
 */
const REPO_RULES = `
Ground rules for working in this repo:
- Read AGENTS.md at the repo root before writing any code; its conventions (module order, function-name prefixes, testing rules) are binding.
- Work ONLY inside the worktree at ${worktree}. Never commit on main.
- The worktree needs its own dependencies: run \`bun install\` inside it first (isolated linker — node_modules are not shared with the main checkout).
- Pre-commit hooks (husky + lint-staged) run codegen, affected typecheck, changed tests, format, and lint on every commit. NEVER bypass them with --no-verify or by editing hook files. If a hook fails, fix the cause and re-commit.
- If your changed tests touch Postgres, start the test container first: \`bun run pg:test-container:start\`.
- Use Conventional Commits${issue ? `, referencing the issue in the scope, e.g. \`feat(#${issue}): …\`` : ''}.
`

const IMPLEMENT_SCHEMA = {
  type: 'object',
  required: ['status', 'summary', 'commits'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: { type: 'string', description: 'What was built, at PR-description altitude' },
    commits: { type: 'array', items: { type: 'string' }, description: 'Commit subjects created' },
    blockedReason: {
      type: 'string',
      description: 'Only when status=blocked: what stopped progress and what is needed',
    },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'severity', 'summary'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { enum: ['blocking', 'minor'] },
          summary: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  required: ['status', 'summary'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    blockedReason: { type: 'string' },
  },
}

const PR_SCHEMA = {
  type: 'object',
  required: ['url', 'number'],
  properties: {
    url: { type: 'string' },
    number: { type: 'integer' },
  },
}

const CI_SCHEMA = {
  type: 'object',
  required: ['conclusion', 'failures'],
  properties: {
    conclusion: { enum: ['green', 'red'] },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['check', 'summary'],
        properties: {
          check: { type: 'string' },
          summary: { type: 'string' },
          logExcerpt: { type: 'string', description: 'The decisive lines from the failing log' },
        },
      },
    },
  },
}

phase('Implement')
const impl = await agent(
  `You are implementing a feature that has already been planned and agreed. Follow the plan; do not redesign it. If the plan is wrong in a way you cannot resolve locally, stop and return status=blocked with the reason rather than improvising a different design.
${REPO_RULES}
Setup: from the repo root, create the worktree if it does not exist (\`git worktree add ${worktree} -b ${branch}\`; if the branch or worktree already exists, reuse it), then \`bun install\` inside it.

The plan:

${plan}

Implement the plan completely, including tests for new behaviour per AGENTS.md testing rules. Commit in logical increments — the pre-commit hooks are your verification gate, so a passing commit means typecheck, changed tests, format, and lint are green for that increment. Do not push and do not open a PR; later stages handle that.`,
  { label: 'implement', model: 'sonnet', schema: IMPLEMENT_SCHEMA },
)

if (!impl) return { status: 'failed', stage: 'implement', branch, worktree, reason: 'implementer agent died or was skipped' }
if (impl.status === 'blocked') {
  return { status: 'blocked', stage: 'implement', branch, worktree, reason: impl.blockedReason }
}
log(`Implemented: ${impl.summary}`)

phase('Review')
const reviewPreamble = `You are reviewing an unpushed feature branch before it becomes a PR. Repo root is the current directory; the branch lives in the worktree at ${worktree}. Read AGENTS.md first — its conventions are binding and convention violations that tooling cannot catch are in scope.

Review the full diff (\`git -C ${worktree} diff main...HEAD\`) and read surrounding source where the diff alone is ambiguous. The plan this branch implements:

${plan}

Classify each finding:
- blocking: correctness bugs, broken or missing tests for new behaviour, deviations from the plan, security problems, AGENTS.md violations that hooks/CI will not catch.
- minor: real but non-blocking improvements. Report them; they will be surfaced to the human reviewer, not fixed here.
Do not modify any files. No praise, no restating the diff.`

let review = await agent(reviewPreamble, {
  label: 'review',
  model: 'opus',
  schema: REVIEW_SCHEMA,
})
if (!review) return { status: 'failed', stage: 'review', branch, worktree, reason: 'review agent died or was skipped' }

let blocking = review.findings.filter((f) => f.severity === 'blocking')
for (let round = 1; blocking.length > 0 && round <= MAX_FIX_ROUNDS; round++) {
  log(`Review round ${round}: ${blocking.length} blocking finding(s), dispatching fixer`)
  const fix = await agent(
    `A reviewer found blocking problems on the feature branch in the worktree at ${worktree}. Fix exactly these findings — no drive-by refactors:
${REPO_RULES}
${JSON.stringify(blocking, null, 2)}

The plan the branch implements, for context:

${plan}

Commit the fixes (hooks must pass). Do not push.`,
    { label: `fix-review-${round}`, model: 'sonnet', schema: FIX_SCHEMA, phase: 'Review' },
  )
  if (!fix || fix.status === 'blocked') {
    return {
      status: 'blocked',
      stage: 'review-fix',
      branch,
      worktree,
      reason: fix ? fix.blockedReason : 'fixer agent died or was skipped',
      outstandingFindings: blocking,
    }
  }
  review = await agent(
    `${reviewPreamble}

A previous review round found these blocking findings, which a fixer has since addressed with new commits:

${JSON.stringify(blocking, null, 2)}

Verify each is genuinely resolved and check the fix commits for new regressions. Return the full current findings list (unresolved findings stay blocking; genuinely fixed ones are dropped).`,
    { label: `re-review-${round}`, model: 'opus', schema: REVIEW_SCHEMA, phase: 'Review' },
  )
  if (!review) return { status: 'failed', stage: 'review', branch, worktree, reason: 're-review agent died or was skipped' }
  blocking = review.findings.filter((f) => f.severity === 'blocking')
}

if (blocking.length > 0) {
  return {
    status: 'review-blocked',
    branch,
    worktree,
    reason: `blocking findings remain after ${MAX_FIX_ROUNDS} fix rounds`,
    outstandingFindings: blocking,
    minorFindings: review.findings.filter((f) => f.severity === 'minor'),
  }
}
const minorFindings = review.findings.filter((f) => f.severity === 'minor')
log(`Review clean (${minorFindings.length} minor finding(s) noted)`)

phase('Open PR')
const pr = await agent(
  `Publish the reviewed feature branch in the worktree at ${worktree} as a PR against main.

1. \`git -C ${worktree} push -u origin ${branch}\`
2. Open the PR with \`gh pr create\` using the repo's template (.github/PULL_REQUEST_TEMPLATE.md): condensed description per the template's rules (lead ≤2 sentences, one-line bullets, ≤150 words)${issue ? `, starting with \`Closes #${issue}\`` : ''}. Title in Conventional Commits form${issue ? ` with the issue scope, e.g. \`feat(#${issue}): …\`` : ''}.

What the branch does: ${impl.summary}

Return the PR URL and number.`,
  { label: 'open-pr', model: 'sonnet', schema: PR_SCHEMA },
)
if (!pr) return { status: 'failed', stage: 'open-pr', branch, worktree, reason: 'PR agent died or was skipped' }
log(`PR opened: ${pr.url}`)

phase('Watch CI')
for (let round = 0; ; round++) {
  const ci = await agent(
    `Watch CI for PR #${pr.number} in this repo until every check completes. Run \`gh pr checks ${pr.number} --watch\` with a 600000ms timeout; if the command times out while checks are still pending, simply run it again — loop until it exits on its own.

When all checks have completed: if everything passed, return conclusion=green with an empty failures array. If anything failed, pull the failing logs (\`gh run view <run-id> --log-failed\`, run ids via \`gh pr checks ${pr.number}\` / \`gh run list --branch ${branch}\`) and return one failures entry per failing check with the decisive log lines as the excerpt. Do not attempt any fixes.`,
    { label: `watch-ci-${round + 1}`, model: 'haiku', effort: 'low', schema: CI_SCHEMA, phase: 'Watch CI' },
  )
  if (!ci) return { status: 'failed', stage: 'watch-ci', branch, worktree, pr: pr.url, reason: 'CI watcher died or was skipped' }

  if (ci.conclusion === 'green') {
    return { status: 'ready', pr: pr.url, branch, worktree, summary: impl.summary, minorFindings }
  }
  if (round >= MAX_FIX_ROUNDS) {
    return {
      status: 'ci-failed',
      pr: pr.url,
      branch,
      worktree,
      reason: `CI still red after ${MAX_FIX_ROUNDS} fix rounds`,
      failures: ci.failures,
      minorFindings,
    }
  }

  log(`CI red (${ci.failures.map((f) => f.check).join(', ')}), dispatching fixer (round ${round + 1})`)
  const fix = await agent(
    `CI is failing on PR #${pr.number} (branch ${branch}, worktree at ${worktree}). Diagnose and fix these failures — reproduce locally where possible before changing code, and fix causes, not symptoms:
${REPO_RULES}
${JSON.stringify(ci.failures, null, 2)}

Commit the fixes (hooks must pass) and push to the existing branch. Do not force-push.`,
    { label: `fix-ci-${round + 1}`, model: 'sonnet', schema: FIX_SCHEMA, phase: 'Watch CI' },
  )
  if (!fix || fix.status === 'blocked') {
    return {
      status: 'blocked',
      stage: 'ci-fix',
      branch,
      worktree,
      pr: pr.url,
      reason: fix ? fix.blockedReason : 'CI fixer died or was skipped',
      failures: ci.failures,
      minorFindings,
    }
  }
}
