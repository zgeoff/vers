import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Creates a postgres container for testing.
 *
 * @returns - The started postgres container.
 */
export function createPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  return (
    new PostgreSqlContainer('postgres:16.2-alpine3.19')
      .withDatabase('test_template')
      .withUsername('test')
      .withPassword('test')

      // use a memory disk for perf
      .withTmpFs({ '/var/lib/pg/data': 'rw' })
      .withEnvironment({
        PGDATA: '/var/lib/pg/data',
      })
      .withExposedPorts({ container: 5432, host: 32_999 })

      // allow reusing our container across tests
      .withReuse()
      .start()
  );
}
