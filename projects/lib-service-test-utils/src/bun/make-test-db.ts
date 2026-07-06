import { createDatabaseTestDB } from './strategies/database-test-db';
import { createTransactionTestDB } from './strategies/transaction-test-db';
import type { TestDB } from './test-db-handle';

export type Isolation = 'database' | 'transaction';

interface TestDBConfig {
  readonly default: Isolation;
  readonly enabled: ReadonlyArray<Isolation>;
}

interface CreateTestDBOptions {
  readonly isolation?: Isolation;
}

const STRATEGIES: Record<Isolation, () => Promise<TestDB>> = {
  database: createDatabaseTestDB,
  transaction: createTransactionTestDB,
};

/**
 * Makes a package's isolated-test-DB factory. Isolation legality is declared, not detected:
 * requesting a strategy absent from `config.enabled` throws. The baseline (the migrated template
 * database) is built once by `setupBunTestDB`; this facade only chooses isolation.
 */
export function makeTestDB(
  config: TestDBConfig,
): (options?: CreateTestDBOptions) => Promise<TestDB> {
  if (!config.enabled.includes(config.default)) {
    throw new Error(
      `makeTestDB: default '${config.default}' not in enabled (${config.enabled.join(', ')})`,
    );
  }

  return function createTestDB(options?: CreateTestDBOptions): Promise<TestDB> {
    const isolation = options?.isolation ?? config.default;

    if (!config.enabled.includes(isolation)) {
      throw new Error(`createTestDB: '${isolation}' not in enabled (${config.enabled.join(', ')})`);
    }

    return STRATEGIES[isolation]();
  };
}
