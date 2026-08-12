import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { WebGPURenderer } from 'three/webgpu';
import type { WebGPURendererParameters } from 'three/webgpu';
import { GameLoopDriver } from './game-loop-driver';
import { registerRendererDiagnostics } from './register-renderer-diagnostics';
import { toFrameloop } from './to-frameloop';
import { useSceneStateStore } from './use-scene-state-store';

interface GameCanvasProps {
  children?: ReactNode;
  forceWebGL?: boolean;
}

/**
 * The persistent, scene-agnostic canvas: one WebGPU (WebGL-fallback) context for the whole app.
 * Frameloop tracks the scene-state store's presentation, so a hidden scene suspends rendering
 * entirely instead of paying GPU cost off-screen. Construction happens inside the `gl` callback,
 * which R3F only invokes client-side, so importing this module is safe under SSR.
 */
export function GameCanvas(props: Readonly<GameCanvasProps>): ReactNode {
  const forceWebGL = props.forceWebGL ?? false;
  const frameloop = useSceneStateStore((state) => toFrameloop(state.presentation));

  return (
    <Canvas
      frameloop={frameloop}
      gl={async (defaultProps) => {
        const parameters = { ...defaultProps, forceWebGL };

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- R3F's default gl props declare their own minimal OffscreenCanvas shim, which structurally conflicts with three's DOM-lib-typed WebGPURendererParameters; both describe the same real canvas at runtime
        const renderer = new WebGPURenderer(parameters as WebGPURendererParameters);

        await renderer.init();

        if (import.meta.env.DEV) {
          registerRendererDiagnostics(renderer);
        }

        return renderer;
      }}
    >
      <GameLoopDriver />
      {props.children}
    </Canvas>
  );
}
