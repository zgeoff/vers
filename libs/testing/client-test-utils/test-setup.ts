import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/orpc/mocks/server';

registerMSWLifecycle(server);
