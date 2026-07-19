import { CastBar } from '@vers/design-system';
import type { CastBarTint } from '@vers/design-system';
import { useCombatElapsed } from '../state/use-combat-elapsed';
import { buildSwingProgress } from './build-swing-progress';

interface SwingBarProps {
  readonly attackSpeed: number;
  readonly isAlive: boolean;
  readonly label: string;
  readonly lastAttackTime: number;
  readonly tint: CastBarTint;
}

/**
 * The live swing/cast fill for one actor. Subscribes to combat elapsed on its own so only this leaf
 * re-renders each tick, then derives the fill from the actor's last attack and swing interval.
 */
export function SwingBar(props: Readonly<SwingBarProps>) {
  const elapsed = useCombatElapsed();

  const progress = buildSwingProgress({
    attackSpeed: props.attackSpeed,
    elapsed,
    isAlive: props.isAlive,
    lastAttackTime: props.lastAttackTime,
  });

  return (
    <CastBar
      label={props.label}
      progress={progress}
      tint={props.tint}
      {...(props.attackSpeed > 0 && { time: `${(1 / props.attackSpeed).toFixed(1)}s` })}
    />
  );
}
