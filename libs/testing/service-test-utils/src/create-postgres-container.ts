import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Wait } from 'testcontainers';

export function createPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  return (
    new PostgreSqlContainer('postgres:16.2-alpine3.19')
      .withDatabase('test_template')
      .withUsername('test')
      .withPassword('test')

      // the default wait strategy adds a listening-ports probe polled via docker exec; under bun
      // the exec response stream never emits `end`, so start() hangs forever. the health check
      // alone (pg_isready) gives the same readiness guarantee without the exec path.
      .withWaitStrategy(Wait.forHealthCheck())

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
