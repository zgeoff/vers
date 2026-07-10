import { useThree } from '@react-three/fiber';
import type { WebGPURenderer } from 'three/webgpu';

/**
 * The sanctioned accessor for the active renderer. Scene code reads the renderer through this
 * hook instead of `state.gl` directly: R3F's own types pin `state.gl` to `THREE.WebGLRenderer`,
 * but the persistent canvas always constructs a `WebGPURenderer` (WebGL is its own internal
 * fallback via `forceWebGL`), so every read needs the same cast — kept here so a renderer swap
 * touches only this one file.
 */
export function useRenderer(): WebGPURenderer {
  return useThree(
    (state) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- R3F's state.gl type is pinned to WebGLRenderer, but the persistent canvas always constructs a WebGPURenderer
      state.gl as unknown as WebGPURenderer,
  );
}
