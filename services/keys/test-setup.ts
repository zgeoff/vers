import '@zgeoff/bun-test-extended';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

process.env['ROLL_KEY_ROOTS'] = JSON.stringify({
  'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
  trade: { current: 1, roots: { 1: '11'.repeat(32), 2: '33'.repeat(32) } },
});

registerBunTestCleanup();
