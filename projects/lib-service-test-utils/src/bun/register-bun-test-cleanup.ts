import { afterEach, mock } from 'bun:test';
import { unstubAllEnvs } from './env-stubbing';

/**
 * Registers the process-wide cleanup contract, called once from a package's preload: restores
 * mocks and stubbed envs after every test. New global state adds its reset here.
 */
export function registerBunTestCleanup(): void {
  afterEach(() => {
    mock.restore();
    unstubAllEnvs();
  });
}
