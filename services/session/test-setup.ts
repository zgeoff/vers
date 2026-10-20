import '@zgeoff/bun-test-extended';
import {
  resolveTestDBTarget,
  resolveTestServiceKeyPair,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';
import { resolveTestJWTKeyPair } from '@vers/test-utils';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

await setupBunTestDB();

const serviceKeyPair = await resolveTestServiceKeyPair();

process.env['SERVICE_AUTH_JWKS'] = serviceKeyPair.jwksJSON;

const jwtKeyPair = await resolveTestJWTKeyPair();

process.env['API_IDENTIFIER'] = 'service-session-test';
process.env['JWT_SIGNING_PRIVKEY'] = jwtKeyPair.privateKeyPEM;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

registerBunTestCleanup();
