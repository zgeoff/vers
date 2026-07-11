import { setupServer } from 'msw/node';

/**
 * The package's single shared MSW server. Its lifecycle is registered once in the bunfig preload;
 * tests add per-test handlers with `server.use(...)` and never touch listen/reset/close.
 */
export const server = setupServer();
