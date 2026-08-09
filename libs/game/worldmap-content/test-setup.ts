import { registerBunTestCleanup, registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/server';

registerBunTestCleanup();
registerMSWLifecycle(server);
