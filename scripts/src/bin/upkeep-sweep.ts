import { $ } from 'bun';
import { z } from 'zod';
import { isTriggerFired } from '../upkeep/is-trigger-fired';
import { parseIgnoredAdvisories } from '../upkeep/parse-ignored-advisories';
import { parseTrigger } from '../upkeep/parse-trigger';

const GHSA_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/g;
const READY_LABEL = 'upkeep-ready';
const manifestSchema = z.object({ scripts: z.record(z.string(), z.string()) });

// stale ignores: an --ignore that no longer matches a live advisory must be deleted
const rawManifest: unknown = await Bun.file('package.json').json();

const manifest = manifestSchema.parse(rawManifest);
const ignored = parseIgnoredAdvisories(manifest.scripts['audit'] ?? '');

const rawAudit = await $`bun audit --json`.nothrow().text();

const liveAdvisories = new Set(rawAudit.match(GHSA_PATTERN));

const staleIgnores = ignored.filter((id) => !liveAdvisories.has(id));

for (const id of staleIgnores) {
  console.log(
    `stale ignore: ${id} no longer matches any advisory - delete it from the audit script`,
  );
}

// trigger sweep: comment and label each upkeep issue whose condition now holds
const labelSchema = z.object({ name: z.string() });

const issueSchema = z.object({
  body: z.string(),
  labels: z.array(labelSchema),
  number: z.number(),
  title: z.string(),
});

const issuesSchema = z.array(issueSchema);

const rawIssues: unknown =
  await $`gh issue list --label upkeep --state open --json number,title,body,labels`.json();

const issues = issuesSchema.parse(rawIssues);

const today = new Date().toISOString().slice(0, 10);

let newlyFired = 0;

for (const issue of issues) {
  const trigger = parseTrigger(issue.body);

  if (!trigger) {
    console.log(`#${issue.number} carries no parseable trigger line - fix its body`);

    newlyFired += 1;
    continue;
  }

  const latestVersion =
    trigger.kind === 'release' ? await readLatestVersion(trigger.pkg) : undefined;

  if (!isTriggerFired(trigger, { latestVersion, today })) {
    continue;
  }

  if (issue.labels.some((label) => label.name === READY_LABEL)) {
    console.log(`#${issue.number} already marked ${READY_LABEL} - awaiting cleanup`);
    continue;
  }

  const detail =
    trigger.kind === 'release'
      ? `\`${trigger.pkg}\` has a release newer than ${trigger.version} (latest: ${latestVersion})`
      : `the recorded date ${trigger.date} has passed`;

  await $`gh issue comment ${issue.number} --body ${`Trigger fired: ${detail}. This upkeep is actionable now.`}`;
  await $`gh issue edit ${issue.number} --add-label ${READY_LABEL}`;

  console.log(`#${issue.number} trigger fired: ${issue.title}`);

  newlyFired += 1;
}

if (staleIgnores.length > 0 || newlyFired > 0) {
  process.exit(1);
}

console.log(
  `swept ${issues.length} upkeep issues, ${ignored.length} audit ignores - nothing newly actionable`,
);

async function readLatestVersion(pkg: string): Promise<string | undefined> {
  const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`);

  if (!response.ok) {
    return undefined;
  }

  const latestSchema = z.object({ version: z.string().optional() });

  const payload = await response.json();

  return latestSchema.parse(payload).version;
}
