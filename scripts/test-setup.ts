import '@zgeoff/bun-test-extended';
import { afterEach } from 'bun:test';
import { setupBunTestDB } from '@vers/service-test-utils/bun';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { neonBranchCollection, neonOperationCollection } from './src/mocks/network';

await setupBunTestDB();

registerBunTestCleanup();

afterEach(() => {
  neonOperationCollection.clear();
  neonBranchCollection.clear();
});
