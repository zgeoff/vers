import { create } from 'zustand';
import type { CameraSlice } from './create-camera-slice';
import { createCameraSlice } from './create-camera-slice';
import type { DevSlice } from './create-dev-slice';
import { createDevSlice } from './create-dev-slice';
import type { GraphSlice } from './create-graph-slice';
import { createGraphSlice } from './create-graph-slice';
import type { InteractionSlice } from './create-interaction-slice';
import { createInteractionSlice } from './create-interaction-slice';

type WorldmapStore = CameraSlice & DevSlice & GraphSlice & InteractionSlice;

export const useWorldmapStore = create<WorldmapStore>()(() => ({
  ...createCameraSlice(),
  ...createDevSlice(),
  ...createGraphSlice(),
  ...createInteractionSlice(),
}));
