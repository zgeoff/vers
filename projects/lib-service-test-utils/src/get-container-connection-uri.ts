import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export function getContainerConnectionURI(container: StartedPostgreSqlContainer) {
  return `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getFirstMappedPort()}`;
}
