import { create } from 'zustand';
import type { CameraSlice } from './create-camera-slice';
import { createCameraSlice } from './create-camera-slice';
import type { DevSlice } from './create-dev-slice';
import { createDevSlice } from './create-dev-slice';
import type { GraphSlice } from './create-graph-slice';
import { createGraphSlice } from './create-graph-slice';
import type { InteractionSlice } from './create-interaction-slice';
import { createInteractionSlice } from './create-interaction-slice';
import type { PerfSlice } from './create-perf-slice';
import { createPerfSlice } from './create-perf-slice';
import type { RevealSlice } from './create-reveal-slice';
import { createRevealSlice } from './create-reveal-slice';
import type { ViewportSlice } from './create-viewport-slice';
import { createViewportSlice } from './create-viewport-slice';

type WorldmapStore = CameraSlice &
  DevSlice &
  GraphSlice &
  InteractionSlice &
  PerfSlice &
  RevealSlice &
  ViewportSlice;

export const useWorldmapStore = create<WorldmapStore>()(() => ({
  ...createCameraSlice(),
  ...createDevSlice(),
  ...createGraphSlice(),
  ...createInteractionSlice(),
  ...createPerfSlice(),
  ...createRevealSlice(),
  ...createViewportSlice(),
}));
