import '@zgeoff/bun-test-extended';
import { afterEach } from 'bun:test';
import { setupBunTestDB } from '@vers/service-test-utils/bun';
import { registerBunTestCleanup, registerMSWLifecycle } from '@vers/test-utils/bun';
import { neonBranchCollection, neonOperationCollection, server } from './src/mocks/node';

await setupBunTestDB();

registerBunTestCleanup();
registerMSWLifecycle(server);

afterEach(() => {
  neonOperationCollection.clear();
  neonBranchCollection.clear();
});
