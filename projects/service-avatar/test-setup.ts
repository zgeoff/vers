import '@zgeoff/bun-test-extended';
import {
  getTestServiceKeyPair,
  registerBunTestCleanup,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';

await setupBunTestDB();

const { publicKeyPEM } = await getTestServiceKeyPair();

// permanent process env for the whole run — not a per-test stub
process.env['SERVICE_AUTH_PUBLIC_KEY'] = publicKeyPEM;

// parsed by `envShape` but never read: `setupTest` injects the transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerBunTestCleanup();
