import { $ } from 'bun';

// the image the dev and e2e stacks run
const postgresImage = 'postgres:16.2-alpine3.19';

// every container this harness starts carries the label, so `docker ps --filter label=` finds one
// that a killed run left
const stackContainerLabel = 'vers-verify=local';

// throwaway credentials of a database that lives as long as one run. The run's endpoint leaves
// them out, because wringer refuses an endpoint URL that holds a password. wringer masks the
// password wherever it appears in output, so it must be a string no row or page holds.
const localDatabaseUser = 'vers_verify';
const localDatabasePassword = 'vers-verify-throwaway-db';

export interface PostgresContainer {
  readonly name: string;
  readonly databaseURL: string;
  readonly endpoint: string;
}

// A throwaway Postgres on a free loopback port, with its data on tmpfs: removing the container
// removes every row, and no volume outlives it.
export async function createPostgresContainer(
  cleanup: AsyncDisposableStack,
  signal: AbortSignal,
): Promise<PostgresContainer> {
  const name = `vers-verify-pg-${process.pid}`;

  await $`docker run --detach --rm --name ${name} --label ${stackContainerLabel} --env POSTGRES_USER=${localDatabaseUser} --env POSTGRES_PASSWORD=${localDatabasePassword} --env POSTGRES_DB=vers --publish 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data ${postgresImage}`.quiet();

  cleanup.defer(async () => {
    await $`docker rm --force --volumes ${name}`.quiet().nothrow();
  });

  const published = await $`docker port ${name} 5432/tcp`.quiet().text();

  const port = published.trim().split(':').at(-1);

  await waitForReady(name, signal);

  const endpoint = `postgresql://127.0.0.1:${port}/vers`;

  return { name, databaseURL: toCredentialedURL(endpoint), endpoint };
}

const readyPollMs = 500;

// a fresh tmpfs database answers within a few seconds; a minute means it will not start
const readyDeadlineMs = 60_000;

async function waitForReady(name: string, signal: AbortSignal): Promise<void> {
  const deadline = performance.now() + readyDeadlineMs;

  while (!signal.aborted) {
    if (performance.now() > deadline) {
      throw new Error(`Postgres in ${name} was not ready within ${readyDeadlineMs / 1000} s`);
    }

    // the image's entrypoint restarts the server once after initdb, so a ready answer over the
    // unix socket can come from the first start; a TCP check answers only from the final one
    const ready =
      await $`docker exec ${name} pg_isready --host 127.0.0.1 --username ${localDatabaseUser} --dbname vers`
        .quiet()
        .nothrow();

    if (ready.exitCode === 0) {
      return;
    }

    await Bun.sleep(readyPollMs);
  }
}

// The database URL a client connects with: the run's `db` endpoint, with the credentials added.
export function toCredentialedURL(endpoint: string): string {
  const url = new URL(endpoint);

  url.username = localDatabaseUser;
  url.password = localDatabasePassword;

  return url.toString();
}
