import { createHash } from 'node:crypto';
import { buildDevDBPrefix } from './build-dev-db-prefix';
import { normalizeDBPart } from './normalize-db-part';

const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Names a worktree's dev database `dev_<machine>_<branch>`. A name that would
 * exceed postgres's 63-byte identifier limit is truncated and suffixed with a
 * hash of the raw machine/branch pair, so distinct branches stay distinct
 * after truncation.
 */
export function buildDevDBName(machine: string, branch: string): string {
  const name = `${buildDevDBPrefix(machine)}${normalizeDBPart(branch)}`;

  if (name.length <= MAX_IDENTIFIER_LENGTH) {
    return name;
  }

  const hash = createHash('sha256').update(`${machine}\n${branch}`).digest('hex').slice(0, 8);

  return `${name.slice(0, MAX_IDENTIFIER_LENGTH - 9)}_${hash}`;
}
