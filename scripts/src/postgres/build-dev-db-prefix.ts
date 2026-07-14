import { normalizeDBPart } from '@vers/db/test-support';

const MAX_MACHINE_LENGTH = 16;

/**
 * The `dev_<machine>_` prefix scoping one machine's dev databases. The machine
 * fragment is capped here, independent of the overall identifier-length
 * truncation, so the prefix stays stable across branch names of any length —
 * sweep relies on that to only ever match the local machine's databases.
 */
export function buildDevDBPrefix(machine: string): string {
  return `dev_${normalizeDBPart(machine).slice(0, MAX_MACHINE_LENGTH)}_`;
}
