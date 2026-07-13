import { setupServer } from 'msw/node';

/**
 * The package's shared MSW server. Tests provision per-call activity-service handlers with
 * `server.use(...)`; its lifecycle is wired once from the bunfig preload.
 */
export const server = setupServer();
