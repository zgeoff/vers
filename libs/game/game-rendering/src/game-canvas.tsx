import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { WebGPURenderer } from 'three/webgpu';
import type { WebGPURendererParameters } from 'three/webgpu';
import invariant from 'tiny-invariant';
import { GameLoopDriver } from './game-loop-driver';
import { registerRendererDiagnostics } from './register-renderer-diagnostics';
import { toFrameloop } from './to-frameloop';
import { useSceneStateStore } from './use-scene-state-store';

interface GameCanvasProps {
  children?: ReactNode;
  forceWebGL?: boolean;
}

export function GameCanvas(props: Readonly<GameCanvasProps>): ReactNode {
  const forceWebGL = props.forceWebGL ?? false;
  const frameloop = useSceneStateStore((state) => toFrameloop(state.presentation));

  // the renderer is constructed inside the `gl` callback, which R3F invokes only on the client, so
  // importing this module is safe under SSR
  return (
    <Canvas
      frameloop={frameloop}
      gl={async (defaultProps) => {
        const canvas = defaultProps.canvas;

        // R3F types its canvas with its own OffscreenCanvas shim, which three's DOM-typed
        // parameters reject; the DOM Canvas always mounts an HTMLCanvasElement
        invariant(canvas instanceof HTMLCanvasElement, 'GameCanvas needs an HTMLCanvasElement');

        // R3F's defaults are canvas, alpha, antialias and powerPreference, typed as WebGL's
        // parameters, whose 'default' power preference WebGPU lacks
        const parameters: WebGPURendererParameters = {
          alpha: defaultProps.alpha,
          antialias: defaultProps.antialias,
          canvas,
          forceWebGL,
          powerPreference:
            defaultProps.powerPreference === 'default' ? undefined : defaultProps.powerPreference,
        };

        const renderer = new WebGPURenderer(parameters);

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
