import { useEffect, useRef, useState } from 'react';
import { useCombatElapsed } from '../state/use-combat-elapsed';
import { buildSwingProgress } from './build-swing-progress';

interface SwingChargeInput {
  readonly attackSpeed: number;
  readonly isAlive: boolean;
  readonly lastAttackTime: number;
}

export function useSwingCharge(input: Readonly<SwingChargeInput>): number {
  const elapsed = useCombatElapsed();
  const [charge, setCharge] = useState(0);

  const anchor = useRef({
    attackSpeed: input.attackSpeed,
    elapsed,
    isAlive: input.isAlive,
    lastAttackTime: input.lastAttackTime,
    wall: 0,
  });

  useEffect(() => {
    anchor.current = {
      attackSpeed: input.attackSpeed,
      elapsed,
      isAlive: input.isAlive,
      lastAttackTime: input.lastAttackTime,
      wall: performance.now(),
    };
  }, [elapsed, input.attackSpeed, input.isAlive, input.lastAttackTime]);

  useEffect(() => {
    let frame = 0;

    const updateCharge = () => {
      const a = anchor.current;
      const extrapolated = a.elapsed + (performance.now() - a.wall);

      const next = Math.round(
        buildSwingProgress({
          attackSpeed: a.attackSpeed,
          elapsed: extrapolated,
          isAlive: a.isAlive,
          lastAttackTime: a.lastAttackTime,
        }),
      );

      setCharge((previous) => (previous === next ? previous : next));

      frame = requestAnimationFrame(updateCharge);
    };

    frame = requestAnimationFrame(updateCharge);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return charge;
}
