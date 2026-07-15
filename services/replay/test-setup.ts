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

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

// parsed by `envShape` but never read: each suite injects its transaction-bound db directly
process.env['DATABASE_URL'] = `${resolveTestDBTarget().baseURI}/postgres`;

// This package's cross-version replay suites dispatch real HTTP to ephemeral test-provider ports on
// the loopback interface, which carry no mock handler; those bypass, and every other unhandled
// request still errors as it does project-wide.
registerMSWLifecycle(server, {
  onUnhandledRequest: (request, print) => {
    const hostname = new URL(request.url).hostname;

    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      return;
    }

    print.error();
  },
});

registerBunTestCleanup();
