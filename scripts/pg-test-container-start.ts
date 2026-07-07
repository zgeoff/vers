import { createPostgresContainer, setupTestDB } from '../projects/lib-service-test-utils/src/index';

const container = await createPostgresContainer();

await setupTestDB(container);

console.log('⚡ postgres test container started');
