import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { useAetherGraphStore } from './src/state/use-aether-graph-store';
import { useCameraStore } from './src/state/use-camera-store';
import { useDevStore } from './src/state/use-dev-store';
import { useHoveredNodeStore } from './src/state/use-hovered-node-store';
import { useSelectedNodeStore } from './src/state/use-selected-node-store';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

// the zustand stores are module singletons; bun runs every test file in one process with no
// isolation, so a test that mutates a store would otherwise leak into the next file's reads
afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();

  useAetherGraphStore.setState(useAetherGraphStore.getInitialState(), true);
  useCameraStore.setState(useCameraStore.getInitialState(), true);
  useDevStore.setState(useDevStore.getInitialState(), true);
  useHoveredNodeStore.setState(useHoveredNodeStore.getInitialState(), true);
  useSelectedNodeStore.setState(useSelectedNodeStore.getInitialState(), true);
});
