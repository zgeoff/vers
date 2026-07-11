import { afterEach, mock } from 'bun:test';
import { removeEnvOverrides } from './remove-env-overrides';

/**
 * Registers the process-wide cleanup contract, called once from a package's preload: restores
 * mocks and env overrides after every test. New global state adds its reset here.
 */
export function registerBunTestCleanup(): void {
  afterEach(() => {
    mock.restore();

    removeEnvOverrides();
  });
}
