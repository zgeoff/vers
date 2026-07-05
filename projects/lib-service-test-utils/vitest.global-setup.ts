import type { TestProject } from 'vitest/node';
import { createPostgresContainer, getContainerConnectionURI, setupTestDB } from './src/index';

declare module 'vitest' {
  export interface ProvidedContext {
    dbURI: string;
    templateDB: string;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function setup(project: TestProject) {
  const container = await createPostgresContainer();

  await setupTestDB(container);

  const dbURI = getContainerConnectionURI(container);

  project.provide('dbURI', dbURI);
  project.provide('templateDB', container.getDatabase());
}
