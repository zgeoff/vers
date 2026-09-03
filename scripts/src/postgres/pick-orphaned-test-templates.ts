import { buildTestTemplateDBName, isTestTemplateDBName } from '@vers/db/test-support';

interface TestTemplateOrphanScan {
  readonly branches: ReadonlyArray<string>;
  readonly dbNames: ReadonlyArray<string>;
}

export function pickOrphanedTestTemplates(scan: Readonly<TestTemplateOrphanScan>): Array<string> {
  const keep = new Set(scan.branches.map((branch) => buildTestTemplateDBName(branch)));

  return scan.dbNames.filter((name) => isTestTemplateDBName(name) && !keep.has(name));
}
