import { createPostgresContainer } from '../projects/lib-service-test-utils/src/index';

// if the container is running, this does nothing except create a reference to it
// so we can stop it
const container = await createPostgresContainer();

await container.stop();

console.log('💤 postgres test container stopped');
