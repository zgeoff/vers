import '@zgeoff/bun-test-extended';
import {
  getTestServiceKeyPair,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';
import { registerBunTestCleanup, registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/server';

await setupBunTestDB();

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_JWKS'] = serviceKeyPair.jwksJSON;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerMSWLifecycle(server);
registerBunTestCleanup();
