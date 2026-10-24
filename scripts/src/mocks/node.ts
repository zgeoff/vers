import { setupServer } from 'msw/node';
import { NEON_API_ORIGIN } from '../migrate/request-neon-json';
import { buildNeonMockHandlers } from './neon/build-neon-mock-handlers';

export const server = setupServer(...buildNeonMockHandlers(NEON_API_ORIGIN));
export { neonBranchCollection } from './neon/neon-branch-collection';
export { neonOperationCollection } from './neon/neon-operation-collection';
