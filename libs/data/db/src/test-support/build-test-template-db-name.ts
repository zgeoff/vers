import { createHash } from 'node:crypto';
import { normalizeDBPart } from './normalize-db-part';
import { TEST_TEMPLATE_DB_PREFIX } from './test-template-db-prefix';

// postgres truncates a longer identifier silently, so two branches that differ only past the limit
// would name the same database; the hash suffix keeps them distinct
const MAX_IDENTIFIER_LENGTH = 63;

export function buildTestTemplateDBName(branch: string): string {
  const name = `${TEST_TEMPLATE_DB_PREFIX}${normalizeDBPart(branch)}`;

  if (name.length <= MAX_IDENTIFIER_LENGTH) {
    return name;
  }

  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);

  return `${name.slice(0, MAX_IDENTIFIER_LENGTH - 9)}_${hash}`;
}
