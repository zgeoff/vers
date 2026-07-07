import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The shared MSW server backing every server-side request in this app — dev boot and tests alike.
 * Test lifecycle is registered once from the bunfig preload; dev boot starts it directly from
 * `vite.config.ts`, since real services aren't integrated until a later phase.
 */
export const server = setupServer(...handlers);
