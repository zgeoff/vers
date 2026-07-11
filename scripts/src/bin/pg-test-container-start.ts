import { createPostgresContainer, setupTestDB } from '@vers/service-test-utils';

const container = await createPostgresContainer();

await setupTestDB(container);

console.log('⚡ postgres test container started');
