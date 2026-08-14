import { expect, test } from 'bun:test';
import { createCameraSlice } from './create-camera-slice';
import { createDevSlice } from './create-dev-slice';
import { createGraphSlice } from './create-graph-slice';
import { createInteractionSlice } from './create-interaction-slice';
import { createPerfSlice } from './create-perf-slice';
import { createRevealSlice } from './create-reveal-slice';
import { createViewportSlice } from './create-viewport-slice';
import { useWorldmapStore } from './use-worldmap-store';

test('it composes every slice into one store', () => {
  expect(useWorldmapStore.getInitialState()).toStrictEqual({
    ...createCameraSlice(),
    ...createDevSlice(),
    ...createGraphSlice(),
    ...createInteractionSlice(),
    ...createPerfSlice(),
    ...createRevealSlice(),
    ...createViewportSlice(),
  });
});
