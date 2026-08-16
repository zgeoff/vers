export const meta = {
  name: 'build-feature',
  description:
    'Implement an agreed feature plan: sonnet builds on a worktree branch, opus reviews the diff, a PR opens once clean, haiku watches CI, with bounded fix loops at each gate',
  whenToUse:
    'After a feature plan has been agreed interactively. Pass args: { plan: string, branch: string, issue?: number, prNumber?: number, verifyCommands?: string[] }. prNumber points at an existing PR to push to and mark ready instead of creating one; verifyCommands are extra full-graph gates the implementer must pass for cross-cutting work. A run cannot pause for conversation — bake every decision it will need into the plan, or split multi-decision phases into separate runs. Returns the PR URL on success or a failure report with the branch left in place for inspection.',
  phases: [
    {
      title: 'Implement',
      detail: 'sonnet implements the plan in a worktree',
      model: 'sonnet',
    },
    {
      title: 'Review',
      detail: 'opus reviews the diff; sonnet fixes blocking findings (max 2 rounds)',
      model: 'opus',
    },
    {
      title: 'Open PR',
      detail: 'rebase onto main, push, open (or ready) the PR',
    },
    {
      title: 'Watch CI',
      detail: 'haiku watches checks; sonnet fixes red CI (max 2 rounds)',
      model: 'haiku',
    },
  ],
};

const MAX_FIX_ROUNDS = 2;

const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

if (!parsedArgs || !parsedArgs.plan || !parsedArgs.branch) {
  throw new Error(
    'build-feature requires args: { plan: string, branch: string, issue?: number, prNumber?: number, verifyCommands?: string[] }',
  );
}

const { plan, branch, issue, prNumber, verifyCommands } = parsedArgs;
const worktree = `.worktrees/${branch}`;

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
- Git hooks are lefthook — read lefthook.yml at the repo root for what each hook actually gates. NEVER bypass hooks with --no-verify or by editing hook files. If a hook fails, fix the cause and re-commit.
- If your changed tests touch Postgres, start the test container first: \`bun run pg:test-container:start\`.
- Use Conventional Commits${issue ? `, referencing the issue in the scope, e.g. \`feat(#${issue}): …\`` : ''}.
`;

const IMPLEMENT_SCHEMA = {
  type: 'object',
  required: ['status', 'summary', 'commits'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: {
      type: 'string',
      description: 'What was built, at PR-description altitude',
    },
    commits: {
      type: 'array',
      items: { type: 'string' },
      description: 'Commit subjects created',
    },
    blockedReason: {
      type: 'string',
      description: 'Only when status=blocked: what stopped progress and what is needed',
    },
  },
};

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
};

const FIX_SCHEMA = {
  type: 'object',
  required: ['status', 'summary'],
  properties: {
    status: { enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    blockedReason: { type: 'string' },
    resolvedConflicts: {
      type: 'boolean',
      description: 'True when the fix involved resolving merge/rebase conflicts by hand',
    },
  },
};

const PR_SCHEMA = {
  type: 'object',
  required: ['url', 'number', 'resolvedConflicts'],
  properties: {
    url: { type: 'string' },
    number: { type: 'integer' },
    resolvedConflicts: {
      type: 'boolean',
      description: 'True when the rebase onto origin/main hit conflicts that were resolved by hand',
    },
  },
};

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
          logExcerpt: {
            type: 'string',
            description: 'The decisive lines from the failing log',
          },
        },
      },
    },
  },
};

phase('Implement');
const verifyGate =
  verifyCommands && verifyCommands.length > 0
    ? `\nThe affected-scope gates above miss cross-cutting breakage. Before your final commit, additionally run each of these from the worktree and get it green:\n${verifyCommands.map((c) => `- \`${c}\``).join('\n')}\n`
    : '';
const impl = await agent(
  `You are implementing a feature that has already been planned and agreed. Follow the plan; do not redesign it. If the plan is wrong in a way you cannot resolve locally, stop and return status=blocked with the reason rather than improvising a different design.
${REPO_RULES}
Setup: from the repo root, create the worktree if it does not exist (\`git worktree add ${worktree} -b ${branch}\`; if the branch or worktree already exists, reuse it), then \`bun install\` inside it.

The plan:

${plan}

Implement the plan completely, including tests for new behaviour per AGENTS.md testing rules. Commit in logical increments. Pre-commit only auto-fixes lint/format on staged files — it proves nothing about types or behaviour. Before your final commit, run \`bunx turbo run typecheck\` and \`bunx turbo run test --affected\` from the worktree and get both green: pre-push and CI gate them anyway, but later stages expect a branch that already passes.
${verifyGate}
Do not push and do not open a PR; later stages handle that.`,
  { label: 'implement', model: 'sonnet', schema: IMPLEMENT_SCHEMA },
);

if (!impl)
  return {
    status: 'failed',
    stage: 'implement',
    branch,
    worktree,
    reason: 'implementer agent died or was skipped',
  };
if (impl.status === 'blocked') {
  return {
    status: 'blocked',
    stage: 'implement',
    branch,
    worktree,
    reason: impl.blockedReason,
  };
}
log(`Implemented: ${impl.summary}`);

phase('Review');
const reviewPreamble = `You are reviewing an unpushed feature branch before it becomes a PR. Repo root is the current directory; the branch lives in the worktree at ${worktree}. Read AGENTS.md first — its conventions are binding and convention violations that tooling cannot catch are in scope.

Review the full diff (\`git -C ${worktree} diff main...HEAD\`) and read surrounding source where the diff alone is ambiguous. The plan this branch implements:

${plan}

Classify each finding:
- blocking: correctness bugs, broken or missing tests for new behaviour, deviations from the plan, security problems, AGENTS.md violations that hooks/CI will not catch.
- minor: real but non-blocking improvements. Report them; they will be surfaced to the human reviewer, not fixed here.
Do not modify any files. No praise, no restating the diff.`;

let review = await agent(reviewPreamble, {
  label: 'review',
  model: 'opus',
  schema: REVIEW_SCHEMA,
});
if (!review)
  return {
    status: 'failed',
    stage: 'review',
    branch,
    worktree,
    reason: 'review agent died or was skipped',
  };

let blocking = review.findings.filter((f) => f.severity === 'blocking');
for (let round = 1; blocking.length > 0 && round <= MAX_FIX_ROUNDS; round++) {
  log(`Review round ${round}: ${blocking.length} blocking finding(s), dispatching fixer`);
  const fix = await agent(
    `A reviewer found blocking problems on the feature branch in the worktree at ${worktree}. Fix exactly these findings — no drive-by refactors:
${REPO_RULES}
${JSON.stringify(blocking, null, 2)}

The plan the branch implements, for context:

${plan}

Commit the fixes (hooks must pass). Do not push.`,
    {
      label: `fix-review-${round}`,
      model: 'sonnet',
      schema: FIX_SCHEMA,
      phase: 'Review',
    },
  );
  if (!fix || fix.status === 'blocked') {
    return {
      status: 'blocked',
      stage: 'review-fix',
      branch,
      worktree,
      reason: fix ? fix.blockedReason : 'fixer agent died or was skipped',
      outstandingFindings: blocking,
    };
  }
  review = await agent(
    `${reviewPreamble}

A previous review round found these blocking findings, which a fixer has since addressed with new commits:

${JSON.stringify(blocking, null, 2)}

Verify each is genuinely resolved and check the fix commits for new regressions. Return the full current findings list (unresolved findings stay blocking; genuinely fixed ones are dropped).`,
    {
      label: `re-review-${round}`,
      model: 'opus',
      schema: REVIEW_SCHEMA,
      phase: 'Review',
    },
  );
  if (!review)
    return {
      status: 'failed',
      stage: 'review',
      branch,
      worktree,
      reason: 're-review agent died or was skipped',
    };
  blocking = review.findings.filter((f) => f.severity === 'blocking');
}

if (blocking.length > 0) {
  return {
    status: 'review-blocked',
    branch,
    worktree,
    reason: `blocking findings remain after ${MAX_FIX_ROUNDS} fix rounds`,
    outstandingFindings: blocking,
    minorFindings: review.findings.filter((f) => f.severity === 'minor'),
  };
}
const minorFindings = review.findings.filter((f) => f.severity === 'minor');
log(`Review clean (${minorFindings.length} minor finding(s) noted)`);

phase('Open PR');
const prBodySpec = `Write the PR body from the branch's actual final diff (\`git -C ${worktree} diff origin/main...HEAD\`) — do not paraphrase second-hand summaries — following the repo template (.github/PULL_REQUEST_TEMPLATE.md): condensed description (lead ≤2 sentences, one-line bullets, ≤150 words), no narrative about review rounds or fix history${issue ? `, starting with \`Closes #${issue}\`` : ''}. For orientation only, the implementer summarized the work as: ${impl.summary}`;
const prAction = prNumber
  ? `Update the existing PR #${prNumber}: refresh its body with \`gh pr edit ${prNumber}\` and mark it ready for review with \`gh pr ready ${prNumber}\`. Return its URL and number.`
  : `Open the PR with \`gh pr create --head ${branch}\`, title in Conventional Commits form${issue ? ` with the issue scope, e.g. \`feat(#${issue}): …\`` : ''}. Return the new PR's URL and number.`;
const pr = await agent(
  `Publish the reviewed feature branch in the worktree at ${worktree} as a PR against main.

1. Bring the branch up to date: \`git -C ${worktree} fetch origin\` then \`git -C ${worktree} rebase origin/main\`. If the rebase hits conflicts, resolve them faithfully to both sides' intent (rerun \`bun install\` in the worktree if dependency manifests changed) and return resolvedConflicts=true; if it was clean or a no-op, return resolvedConflicts=false.
2. Push with \`git -C ${worktree} push -u origin ${branch}\`, adding \`--force-with-lease\` only if the rebase rewrote commits that were already pushed.
3. ${prAction}

${prBodySpec}`,
  {
    label: prNumber ? 'ready-pr' : 'open-pr',
    model: 'sonnet',
    schema: PR_SCHEMA,
  },
);
if (!pr)
  return {
    status: 'failed',
    stage: 'open-pr',
    branch,
    worktree,
    reason: 'PR agent died or was skipped',
  };
let rebaseConflicts = Boolean(pr.resolvedConflicts);
log(`${prNumber ? 'PR readied' : 'PR opened'}: ${pr.url}`);

phase('Watch CI');
for (let round = 0; ; round++) {
  const ci = await agent(
    `Watch CI for PR #${pr.number} in this repo until every check completes. Run \`gh pr checks ${pr.number} --watch\` with a 600000ms timeout; if the command times out while checks are still pending, simply run it again — loop until it exits on its own.

If \`gh pr checks\` reports no checks at all (it can exit immediately), do NOT assume green: run \`gh pr view ${pr.number} --json mergeable,mergeStateStatus\`. If the PR is CONFLICTING, return conclusion=red with a single failures entry using check "merge-conflict" and what gh reported as the summary. If it is mergeable and checks simply have not started yet, wait briefly and watch again.

When all checks have completed: if everything passed, return conclusion=green with an empty failures array. If anything failed, pull the failing logs (\`gh run view <run-id> --log-failed\`, run ids via \`gh pr checks ${pr.number}\` / \`gh run list --branch ${branch}\`) and return one failures entry per failing check with the decisive log lines as the excerpt. Do not attempt any fixes.`,
    {
      label: `watch-ci-${round + 1}`,
      model: 'haiku',
      effort: 'low',
      schema: CI_SCHEMA,
      phase: 'Watch CI',
    },
  );
  if (!ci)
    return {
      status: 'failed',
      stage: 'watch-ci',
      branch,
      worktree,
      pr: pr.url,
      reason: 'CI watcher died or was skipped',
    };

  if (ci.conclusion === 'green') {
    return {
      status: 'ready',
      pr: pr.url,
      branch,
      worktree,
      summary: impl.summary,
      minorFindings,
      rebaseConflicts,
    };
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
      rebaseConflicts,
    };
  }

  log(
    `CI red (${ci.failures.map((f) => f.check).join(', ')}), dispatching fixer (round ${round + 1})`,
  );
  const fix = await agent(
    `CI is failing on PR #${pr.number} (branch ${branch}, worktree at ${worktree}). Diagnose and fix these failures — reproduce locally where possible before changing code, and fix causes, not symptoms:
${REPO_RULES}
${JSON.stringify(ci.failures, null, 2)}

If a failure's check is "merge-conflict", the branch has fallen behind main: \`git -C ${worktree} fetch origin\`, rebase onto origin/main, resolve conflicts faithfully to both sides' intent (rerun \`bun install\` in the worktree if dependency manifests changed), push with \`--force-with-lease\` — that flag is allowed for this case ONLY — and return resolvedConflicts=true if you resolved conflicts by hand.

For every other failure, commit the fixes (hooks must pass) and push to the existing branch without force.`,
    {
      label: `fix-ci-${round + 1}`,
      model: 'sonnet',
      schema: FIX_SCHEMA,
      phase: 'Watch CI',
    },
  );
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
      rebaseConflicts,
    };
  }
  if (fix.resolvedConflicts) rebaseConflicts = true;
}
