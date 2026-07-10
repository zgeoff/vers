import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { useSceneStateStore } from './src/use-scene-state-store';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

// the store is a module singleton; bun runs every test file in one process with no isolation,
// so a test that mutates it would otherwise leak into the next file's reads
afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();

  useSceneStateStore.setState(useSceneStateStore.getInitialState(), true);
});
