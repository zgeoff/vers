import '@zgeoff/bun-test-extended';
import { server } from '@vers/email/mocks';
import {
  getTestServiceKeyPair,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';
import { registerBunTestCleanup, registerMSWLifecycle } from '@vers/test-utils/bun';

await setupBunTestDB();

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

// parsed by `envShape` but never read in most tests: each suite injects its own cloned
// `queueConnectionString` directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerMSWLifecycle(server);
registerBunTestCleanup();
