import '@zgeoff/bun-test-extended';
import { getTestServiceKeyPair, setupBunTestDB } from '@vers/service-test-utils/bun';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

await setupBunTestDB();

const serviceKeyPair = await getTestServiceKeyPair();

process.env['SERVICE_AUTH_PUBLIC_KEY'] = serviceKeyPair.publicKeyPEM;

registerBunTestCleanup();
