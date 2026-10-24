import { z } from 'zod';
import { collectStaleAgeGateExcludes } from '../dependencies/collect-stale-age-gate-excludes';
import { collectUnneededAuditIgnores } from '../dependencies/collect-unneeded-audit-ignores';
import { collectUnneededOverrides } from '../dependencies/collect-unneeded-overrides';
import { parseAuditFixPlan } from '../dependencies/parse-audit-fix-plan';
import { parseAuditIgnoreIDs } from '../dependencies/parse-audit-ignore-ids';
import { parseAuditReport } from '../dependencies/parse-audit-report';
import { parseLockfileDependents } from '../dependencies/parse-lockfile-dependents';

const versionsSchema = z.record(z.string(), z.string());

const rootManifestSchema = z.object({
  overrides: versionsSchema.default({}),
  workspaces: z.object({ catalog: versionsSchema.default({}) }),
  scripts: z.object({ audit: z.string() }),
});

const today = new Date().toISOString().slice(0, 10);

const rootManifestJSON: unknown = await Bun.file('package.json').json();

const rootManifest = rootManifestSchema.parse(rootManifestJSON);

const bunfig = await Bun.file('bunfig.toml').text();
const lockfile = await Bun.file('bun.lock').text();
const auditReport = await readBunOutput(['audit', '--json']);
const auditFixPlan = await readBunOutput(['audit', 'fix', '--dry-run', '--json']);

const findings = [
  ...collectStaleAgeGateExcludes(bunfig, today),
  ...collectUnneededOverrides({
    overrides: rootManifest.overrides,
    catalog: rootManifest.workspaces.catalog,
    dependents: parseLockfileDependents(lockfile),
  }),
  ...collectUnneededAuditIgnores({
    ignoreIDs: parseAuditIgnoreIDs(rootManifest.scripts.audit),
    advisories: parseAuditReport(auditReport),
    fixablePackages: parseAuditFixPlan(auditFixPlan),
  }),
];

if (findings.length > 0) {
  console.error(`check-dependency-gates: ${findings.length} entry(s) to remove`);

  for (const finding of findings) {
    console.error(`  ${finding.entry}: ${finding.problem}`);
  }

  process.exit(1);
}

console.log('check-dependency-gates: every exclude, override and audit ignore is still needed');

// `bun audit` exits 1 while any advisory remains, ignored ones included, so only empty output fails.
async function readBunOutput(args: ReadonlyArray<string>): Promise<string> {
  const bun = Bun.spawn(['bun', ...args], { stdout: 'pipe', stderr: 'inherit' });

  const [output, exitCode] = await Promise.all([new Response(bun.stdout).text(), bun.exited]);

  if (output.trim() === '') {
    throw new Error(`bun ${args.join(' ')} printed nothing and exited ${exitCode}`);
  }

  return output;
}
