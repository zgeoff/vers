import { css, cx } from '@vers/styled-system/css';
import { useCombatElapsed } from '../state/use-combat-elapsed';

const attackTimerBar = css({
  backgroundColor: 'gray.700',
  borderColor: 'gray.800',
  borderWidth: '1',
  height: '2',
  overflow: 'hidden',
  position: 'relative',
  rounded: 'xs',
  width: 'full',
  zIndex: '1',
});

const attackTimerBarFill = css({
  backgroundColor: 'twine.300',
  height: '2',
  rounded: 'xs',
  transition: '[width]',
  transitionDuration: 'fastest',
  transitionTimingFunction: 'linear',
});

const noTransition = css({
  transition: '[none]',
});

interface AttackTimerBarProps {
  isAlive: boolean;
  lastAttackTime: number;
  nextAttackTime: number;
}

export function AttackTimerBar(props: AttackTimerBarProps) {
  const elapsed = useCombatElapsed();
  const attackTime = props.nextAttackTime - props.lastAttackTime;
  const progressMS = elapsed - props.lastAttackTime;
  const progress = props.isAlive ? Math.round((progressMS / attackTime) * 100) : 0;

  return (
    <div className={attackTimerBar}>
      <div
        className={cx(attackTimerBarFill, progress === 0 && noTransition)}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
