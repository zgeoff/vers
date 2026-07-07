import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The shared MSW server backing every server-side request — dev boot and tests alike. Test
 * lifecycle is registered once from the bunfig preload; dev boot starts it directly.
 */
export const server = setupServer(...handlers);
