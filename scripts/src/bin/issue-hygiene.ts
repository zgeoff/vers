import { $ } from 'bun';
import { z } from 'zod';
import { checkIssue } from '../issue-hygiene/check-issue';

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

if (findings.length === 0) {
  console.log(`#${issueNumber} is clean`);
  process.exit(0);
}

const comment = [
  'Issue hygiene check found defects:',
  '',
  ...findings.map((finding) => `- ${finding}`),
  '',
  'Templates live in `.github/ISSUE_TEMPLATE`; the rules are the Issue hygiene section of AGENTS.md.',
].join('\n');

await $`gh issue comment ${issueNumber} --body ${comment}`;

for (const finding of findings) {
  console.log(`#${issueNumber}: ${finding}`);
}

process.exit(1);
