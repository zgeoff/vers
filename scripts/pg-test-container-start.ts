import { createPostgresContainer, setupTestDB } from '../projects/lib-service-test-utils/src/index';

const container = await createPostgresContainer();

await setupTestDB(container, {
  migrationsFolder: './projects/db-postgres/migrations',
});

console.log('⚡ postgres test container started');
