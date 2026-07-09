/** The test container's base connection URI and migrated template database name. */
interface TestDBTarget {
  readonly baseURI: string;
  readonly templateDB: string;
}

const DEFAULT_TEST_DB_URI = 'postgres://test:test@localhost:32999';
const DEFAULT_TEST_TEMPLATE_DB = 'test_template';

/**
 * Resolves the test container's base URI and migrated template DB name,
 * published to the `TEST_DB_URI`/`TEST_TEMPLATE_DB` env vars once per test
 * process by `test-setup.ts`. Falls back to the test container's fixed
 * defaults so a bare `bun test` against an already-running container still
 * resolves.
 */
export function resolveTestDBTarget(): TestDBTarget {
  return {
    baseURI: process.env['TEST_DB_URI'] ?? DEFAULT_TEST_DB_URI,
    templateDB: process.env['TEST_TEMPLATE_DB'] ?? DEFAULT_TEST_TEMPLATE_DB,
  };
}
