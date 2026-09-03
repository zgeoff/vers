import { afterEach, mock } from 'bun:test';
import { removeEnvOverrides } from './remove-env-overrides';

export function registerBunTestCleanup(): void {
  afterEach(() => {
    mock.restore();

    removeEnvOverrides();
  });
}
