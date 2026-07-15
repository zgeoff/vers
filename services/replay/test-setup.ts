import '@zgeoff/bun-test-extended';
import { afterAll, afterEach } from 'bun:test';
import {
  getTestServiceKeyPair,
  resolveTestDBTarget,
  setupBunTestDB,
} from '@vers/service-test-utils/bun';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';

await setupBunTestDB();

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

// `bypass`, not the usual project-wide `error`: this package's other suites dispatch real HTTP to
// ephemeral test-provider ports (the cross-version replay dispatch), which carry no mock handler
// and must reach the real network rather than fail as unhandled.
server.listen({ onUnhandledRequest: 'bypass' });

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

registerBunTestCleanup();
