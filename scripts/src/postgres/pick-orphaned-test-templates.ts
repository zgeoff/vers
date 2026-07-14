import { buildTestTemplateDBName, isTestTemplateDBName } from '@vers/db/test-support';

interface TestTemplateOrphanScan {
  readonly branches: ReadonlyArray<string>;
  readonly dbNames: ReadonlyArray<string>;
}

/**
 * Branch-scoped test-template databases whose branch no longer exists
 * locally. The container's own bootstrap `test_template` database and any
 * unrelated database never match, so a sweep can only ever drop what this
 * worktree's test runs provisioned.
 */
export function pickOrphanedTestTemplates(scan: Readonly<TestTemplateOrphanScan>): Array<string> {
  const keep = new Set(scan.branches.map((branch) => buildTestTemplateDBName(branch)));

  return scan.dbNames.filter((name) => isTestTemplateDBName(name) && !keep.has(name));
}
