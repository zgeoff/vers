import { createHash } from 'node:crypto';
import { normalizeDBPart } from './normalize-db-part';
import { TEST_TEMPLATE_DB_PREFIX } from './test-template-db-prefix';

const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Names a worktree's test-template database `test_template_<branch>`,
 * scoping the shared test container's template per branch so concurrent
 * worktrees on the same machine stop clobbering each other's schema. A name
 * that would exceed postgres's 63-byte identifier limit is truncated and
 * suffixed with a hash of the raw branch name, so distinct branches stay
 * distinct after truncation — mirrors `buildDevDBName`'s guard.
 */
export function buildTestTemplateDBName(branch: string): string {
  const name = `${TEST_TEMPLATE_DB_PREFIX}${normalizeDBPart(branch)}`;

  if (name.length <= MAX_IDENTIFIER_LENGTH) {
    return name;
  }

  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);

  return `${name.slice(0, MAX_IDENTIFIER_LENGTH - 9)}_${hash}`;
}
