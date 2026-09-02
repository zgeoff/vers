import { raf } from '@react-spring/rafz';
import { useFrame } from '@react-three/fiber';
import { gameLoop } from './game-loop';

// `raf.frameLoop` is set to 'demand' once, here, so springs step only through this driver's
// `raf.advance` and freeze whenever the canvas's frameloop is `never`; nothing else in this package
// or a consumer may call either
if (raf.frameLoop !== 'demand') {
  raf.frameLoop = 'demand';
}

export function GameLoopDriver(): null {
  useFrame((state, delta) => {
    raf.advance();
    gameLoop.runGameLoopCallbacks(delta, state.clock.elapsedTime);
  });

  return null;
}
