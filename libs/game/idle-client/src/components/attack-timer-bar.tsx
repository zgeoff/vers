import { css } from '@vers/styled-system/css';
import { useCombatElapsed } from '../state/use-combat-elapsed';

const attackTimerBar = css({
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderWidth: '[1px]',
  height: '2',
  overflow: 'hidden',
  position: 'relative',
  width: 'full',
  zIndex: '[1]',
});

const attackTimerBarFill = css({
  backgroundColor: 'accent.self',
  height: '2',
});

interface AttackTimerBarProps {
  isAlive: boolean;
  lastAttackTime: number;
  nextAttackTime: number;
}

export function AttackTimerBar(props: Readonly<AttackTimerBarProps>) {
  const elapsed = useCombatElapsed();
  const attackTime = props.nextAttackTime - props.lastAttackTime;
  const progressMS = elapsed - props.lastAttackTime;
  const progress = props.isAlive ? Math.round((progressMS / attackTime) * 100) : 0;

  return (
    <div className={attackTimerBar}>
      <div className={attackTimerBarFill} style={{ width: `${progress}%` }} />
    </div>
  );
}
