import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';

const DEFAULT_TEST_DB_URI = 'postgres://test:test@localhost:32999';
const DEFAULT_TEST_TEMPLATE_DB = 'test_template';

/** The test container's base connection URI and migrated template database name. */
interface TestDBTarget {
  readonly baseURI: string;
  readonly templateDB: string;
}

/**
 * Resolves the test container's base URI and migrated template DB name, published by
 * `setupBunTestDB` as `TEST_DB_URI`/`TEST_TEMPLATE_DB`. Falls back to the test container's fixed
 * defaults so a bare `bun test` against an already-running container still resolves.
 */
export function resolveTestDBTarget(): TestDBTarget {
  return {
    baseURI: process.env['TEST_DB_URI'] ?? DEFAULT_TEST_DB_URI,
    templateDB: process.env['TEST_TEMPLATE_DB'] ?? DEFAULT_TEST_TEMPLATE_DB,
  };
}

/** Clones the migrated template database into a freshly named database; returns its connection URL. */
export async function cloneTemplateDatabase(): Promise<string> {
  const { baseURI, templateDB } = resolveTestDBTarget();
  const admin = postgres(`${baseURI}/postgres`);
  const dbName = `test_${createId()}`;

  try {
    await admin.unsafe(/* SQL */ `CREATE DATABASE ${dbName} TEMPLATE ${templateDB}`);
  } finally {
    await admin.end();
  }

  return `${baseURI}/${dbName}`;
}
