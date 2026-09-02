import { createHash } from 'node:crypto';
import { normalizeDBPart } from '@vers/db/test-support';
import { buildDevDBPrefix } from './build-dev-db-prefix';

const MAX_IDENTIFIER_LENGTH = 63;

export function buildDevDBName(machine: string, branch: string): string {
  const name = `${buildDevDBPrefix(machine)}${normalizeDBPart(branch)}`;

  if (name.length <= MAX_IDENTIFIER_LENGTH) {
    return name;
  }

  const hash = createHash('sha256').update(`${machine}\n${branch}`).digest('hex').slice(0, 8);

  return `${name.slice(0, MAX_IDENTIFIER_LENGTH - 9)}_${hash}`;
}
