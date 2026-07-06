import '@zgeoff/bun-test-extended';
import {
  getTestServiceKeyPair,
  registerBunTestCleanup,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';
import { getTestJWTKeyPair } from './src/test-utils/get-test-jwt-key-pair';

await setupBunTestDB();

const { publicKeyPEM } = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = publicKeyPEM;

const { privateKeyPEM } = await getTestJWTKeyPair();

process.env['API_IDENTIFIER'] = 'service-session-test';
process.env['JWT_SIGNING_PRIVKEY'] = privateKeyPEM;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerBunTestCleanup();
