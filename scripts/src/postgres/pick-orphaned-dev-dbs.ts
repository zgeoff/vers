import { buildDevDBName } from './build-dev-db-name';
import { buildDevDBPrefix } from './build-dev-db-prefix';

interface OrphanScan {
  branches: ReadonlyArray<string>;
  dbNames: ReadonlyArray<string>;
  machine: string;
}

export function pickOrphanedDevDBs(scan: Readonly<OrphanScan>): Array<string> {
  const prefix = buildDevDBPrefix(scan.machine);

  const keep = new Set(scan.branches.map((branch) => buildDevDBName(scan.machine, branch)));

  return scan.dbNames.filter((name) => name.startsWith(prefix) && !keep.has(name));
}
