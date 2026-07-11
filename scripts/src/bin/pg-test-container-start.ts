import { createPostgresContainer, setupTestDB } from '@vers/service-test-utils';

const container = await createPostgresContainer();

await setupTestDB(container);

console.log('⚡ postgres test container started');

// testcontainers' reaper socket stays open by design, and bun does not unref
// it the way node does — without an explicit exit the process hangs forever
process.exit(0);
