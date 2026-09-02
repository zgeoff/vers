import { normalizeDBPart } from '@vers/db/test-support';

const MAX_MACHINE_LENGTH = 16;

export function buildDevDBPrefix(machine: string): string {
  return `dev_${normalizeDBPart(machine).slice(0, MAX_MACHINE_LENGTH)}_`;
}
