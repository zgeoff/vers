import { CastBar } from '@vers/design-system';
import type { CastBarTint } from '@vers/design-system';
import { useSwingCharge } from './use-swing-charge';

interface SwingBarProps {
  readonly attackSpeed: number;
  readonly isAlive: boolean;
  readonly label: string;
  readonly lastAttackTime: number;
  readonly tint: CastBarTint;
}

export function SwingBar(props: Readonly<SwingBarProps>) {
  const charge = useSwingCharge({
    attackSpeed: props.attackSpeed,
    isAlive: props.isAlive,
    lastAttackTime: props.lastAttackTime,
  });

  return (
    <CastBar
      label={props.label}
      progress={charge}
      tint={props.tint}
      {...(props.attackSpeed > 0 && { time: `${(1 / props.attackSpeed).toFixed(1)}s` })}
    />
  );
}
