import { $ } from 'bun';
import { z } from 'zod';
import { checkIssue } from '../issue-hygiene/check-issue';
import { findSectionStub } from '../issue-hygiene/find-section-stub';
import { HYGIENE_MARKER, renderHygieneComment } from '../issue-hygiene/render-hygiene-comment';
import type { Finding, ResolvedFinding } from '../issue-hygiene/types';

const issueNumber = Number(process.argv[2]);

if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  console.error('usage: issue-hygiene.ts <issue>');
  process.exit(1);
}

const labelSchema = z.object({ name: z.string() });

const issueSchema = z.object({
  body: z.string(),
  labels: z.array(labelSchema),
  milestone: z.object({ title: z.string() }).nullable(),
});

const rawIssue: unknown = await $`gh issue view ${issueNumber} --json body,labels,milestone`.json();

const issue = issueSchema.parse(rawIssue);

const findings = checkIssue({
  body: issue.body,
  labels: issue.labels.map((label) => label.name),
  milestone: issue.milestone?.title ?? null,
});

const resolved = await Promise.all(findings.map((finding) => resolveFinding(finding)));

const body = renderHygieneComment(resolved);

const repoResult = await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text();

const repo = process.env['GITHUB_REPOSITORY'] ?? repoResult.trim();

const existingCommentID = await findStickyCommentID(repo, issueNumber);

// a clean issue that never earned a sticky comment needs none — only issues the bot has already
// commented on get their comment flipped to the all-clear rendering
if (findings.length === 0 && existingCommentID === null) {
  console.log(`#${issueNumber} is clean`);
  process.exit(0);
}

await upsertStickyComment(repo, issueNumber, existingCommentID, body);

for (const finding of findings) {
  console.log(`#${issueNumber}: ${finding.task}`);
}

async function resolveFinding(finding: Finding): Promise<ResolvedFinding> {
  if (finding.stub === undefined) {
    return { rule: finding.rule, task: finding.task };
  }

  if (finding.stub.kind === 'literal') {
    return { rule: finding.rule, stub: finding.stub.markdown, task: finding.task };
  }

  const template = await Bun.file(finding.stub.templatePath).text();

  const stub = findSectionStub(template, finding.stub.title);

  return stub === null
    ? { rule: finding.rule, task: finding.task }
    : { rule: finding.rule, stub, task: finding.task };
}

async function findStickyCommentID(repository: string, issueNum: number): Promise<number | null> {
  const commentSchema = z.array(z.object({ body: z.string(), id: z.number() }));

  const raw: unknown =
    await $`gh api repos/${repository}/issues/${issueNum}/comments --paginate`.json();

  const sticky = commentSchema
    .parse(raw)
    .find((comment) => comment.body.startsWith(HYGIENE_MARKER));

  return sticky?.id ?? null;
}

async function upsertStickyComment(
  repository: string,
  issueNum: number,
  commentID: number | null,
  commentBody: string,
): Promise<void> {
  if (commentID === null) {
    await $`gh api --method POST repos/${repository}/issues/${issueNum}/comments -f body=${commentBody}`.quiet();

    return;
  }

  await $`gh api --method PATCH repos/${repository}/issues/comments/${commentID} -f body=${commentBody}`.quiet();
}
