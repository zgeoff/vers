import '@zgeoff/bun-test-extended';
import { setupBunTestDB } from '@vers/service-test-utils/bun';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

await setupBunTestDB();

registerBunTestCleanup();
