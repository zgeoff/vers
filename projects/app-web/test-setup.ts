import '@zgeoff/bun-test-extended';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { registerMSWLifecycle } from '@vers/client-test-utils/test-setup';
import { server } from './mocks/node';

GlobalRegistrator.register();

registerMSWLifecycle(server);
