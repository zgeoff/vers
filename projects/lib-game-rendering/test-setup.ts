import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { useSatelliteStore } from './src/use-satellite-store';
import { useSceneStateStore } from './src/use-scene-state-store';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

// these stores are module singletons; bun runs every test file in one process with no
// isolation, so a test that mutates one would otherwise leak into the next file's reads
afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();

  useSceneStateStore.setState(useSceneStateStore.getInitialState(), true);
  useSatelliteStore.setState(useSatelliteStore.getInitialState(), true);
});
