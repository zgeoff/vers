import { createDatabaseTestDB } from './strategies/create-database-test-db';
import { createTransactionTestDB } from './strategies/create-transaction-test-db';
import type { TestDBHandle } from './test-db-handle';

export type Isolation = 'database' | 'transaction';

interface TestDBConfig {
  readonly default: Isolation;
  readonly enabled: ReadonlyArray<Isolation>;
}

interface CreateTestDBOptions {
  readonly isolation?: Isolation;
}

const STRATEGIES: Record<Isolation, () => Promise<TestDBHandle>> = {
  database: createDatabaseTestDB,
  transaction: createTransactionTestDB,
};

/**
 * Makes a package's isolated-test-DB factory. Isolation legality is declared, not detected:
 * requesting a strategy absent from `config.enabled` throws. The migrated template database is
 * built once per test process; this facade only chooses isolation.
 */
export function makeTestDB(
  config: TestDBConfig,
): (options?: CreateTestDBOptions) => Promise<TestDBHandle> {
  if (!config.enabled.includes(config.default)) {
    throw new Error(
      `makeTestDB: default '${config.default}' not in enabled (${config.enabled.join(', ')})`,
    );
  }

  return function createTestDB(options?: CreateTestDBOptions): Promise<TestDBHandle> {
    const isolation = options?.isolation ?? config.default;

    if (!config.enabled.includes(isolation)) {
      throw new Error(`createTestDB: '${isolation}' not in enabled (${config.enabled.join(', ')})`);
    }

    return STRATEGIES[isolation]();
  };
}
