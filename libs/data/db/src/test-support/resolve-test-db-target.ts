import { buildTestTemplateDBName } from './build-test-template-db-name';
import { readCurrentBranch } from './read-current-branch';

interface TestDBTarget {
  readonly baseURI: string;
  readonly templateDB: string;
}

const DEFAULT_TEST_DB_URI = 'postgres://test:test@localhost:32999';

export function resolveTestDBTarget(): TestDBTarget {
  return {
    baseURI: process.env['TEST_DB_URI'] ?? DEFAULT_TEST_DB_URI,
    templateDB: process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch()),
  };
}
