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
 * The live swing timer for one actor, drawn as a cooldown: full the instant after an attack lands,
 * draining to empty as the next swing charges. Subscribes to combat elapsed on its own so only this
 * leaf re-renders each tick.
 */
export function SwingBar(props: Readonly<SwingBarProps>) {
  const elapsed = useCombatElapsed();
  const active = props.isAlive && props.attackSpeed > 0;

  const charge = buildSwingProgress({
    attackSpeed: props.attackSpeed,
    elapsed,
    isAlive: props.isAlive,
    lastAttackTime: props.lastAttackTime,
  });

  return (
    <CastBar
      label={props.label}
      progress={active ? 100 - charge : 0}
      tint={props.tint}
      {...(props.attackSpeed > 0 && { time: `${(1 / props.attackSpeed).toFixed(1)}s` })}
    />
  );
}
