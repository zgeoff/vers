import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function getContainerConnectionURI(container: StartedPostgreSqlContainer) {
  return `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;
}
