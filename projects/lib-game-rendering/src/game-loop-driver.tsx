import { raf } from '@react-spring/rafz';
import { useFrame } from '@react-three/fiber';
import { gameLoop } from './game-loop';

// this module owns the rafz clock: `raf.advance` is called only here, and `raf.frameLoop` is
// set only here, once, at module init — springs step exclusively through this driver's
// `useFrame`, deterministically, and freeze correctly whenever the canvas's frameloop is
// `never`. Nothing else in this package (or a consumer) may call either.
if (raf.frameLoop !== 'demand') {
  raf.frameLoop = 'demand';
}

/**
 * Mounted once inside the persistent canvas. Each driven frame it steps the react-spring rafz
 * clock via `raf.advance`, then runs every callback registered against the package's shared
 * game-loop instance, in that order.
 */
export function GameLoopDriver(): null {
  useFrame((state, delta) => {
    raf.advance();
    gameLoop.runGameLoopCallbacks(delta, state.clock.elapsedTime);
  });

  return null;
}
