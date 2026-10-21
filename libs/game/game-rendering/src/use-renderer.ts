import { useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

// the persistent canvas constructs a WebGPURenderer, but R3F types state.gl as the WebGLRenderer
// that test harnesses construct by default, so a caller handles both
export function useRenderer(): WebGLRenderer | WebGPURenderer {
  return useThree((state) => state.gl);
}
