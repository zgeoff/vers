/**
 * The pure replay entrypoint: its transitive closure is the versioned
 * simulation behaviour. The deploy pipeline hashes a bundle built from this
 * entrypoint, so the hash changes whenever a module it reaches changes and
 * stays stable otherwise. Excludes `src/test-utils`, which pulls in
 * `@faker-js/faker`, a devDependency with no place in a shipped bundle.
 */
export { createSimulation } from './core/create-simulation';
export { runSimulation } from './core/run-simulation';
export type * from './types';
