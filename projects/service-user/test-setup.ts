import '@zgeoff/bun-test-extended';
import {
  getTestServiceKeyPair,
  registerBunTestCleanup,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';

await setupBunTestDB();

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerBunTestCleanup();
