import { buildTestTemplateDBName } from './build-test-template-db-name';
import { readCurrentBranch } from './read-current-branch';

/**
 * The test container's base connection URI and migrated template database name.
 */
interface TestDBTarget {
  readonly baseURI: string;
  readonly templateDB: string;
}

const DEFAULT_TEST_DB_URI = 'postgres://test:test@localhost:32999';

/**
 * Resolves the test container's base URI and migrated template DB name,
 * published to the `TEST_DB_URI`/`TEST_TEMPLATE_DB` env vars once per test
 * process by `test-setup.ts`. Falls back to the test container's fixed
 * default URI and this worktree's branch-scoped template name, so a bare
 * `bun test` against an already-running container still resolves to the
 * template `pg:test-container:start` provisioned for the current branch.
 */
export function resolveTestDBTarget(): TestDBTarget {
  return {
    baseURI: process.env['TEST_DB_URI'] ?? DEFAULT_TEST_DB_URI,
    templateDB: process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch()),
  };
}
