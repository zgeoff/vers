import { createTestNetwork } from '@zgeoff/testing/fetch';
import { NEON_API_ORIGIN } from '../migrate/request-neon-json';
import { buildNeonMockHandlers } from './neon/build-neon-mock-handlers';

export const network = createTestNetwork({ handlers: buildNeonMockHandlers(NEON_API_ORIGIN) });
export { neonBranchCollection } from './neon/neon-branch-collection';
export { neonOperationCollection } from './neon/neon-operation-collection';
