import { useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';

export function useRenderer(): WebGPURenderer {
  return useThree(
    (state) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- R3F's state.gl type is pinned to WebGLRenderer, but the persistent canvas always constructs a WebGPURenderer
      state.gl as unknown as WebGPURenderer,
  );
}
