import { Heading } from '@vers/design-system';
import type { EnemyAppState } from '@vers/idle-core';
import { css, cx } from '@vers/styled-system/css';
import { AttackTimerBar } from './attack-timer-bar';
import { LifeBar } from './life-bar';

const enemyInfo = css({
  _last: {
    marginBottom: '0',
  },
  backgroundColor: 'gray.900',
  borderColor: 'gray.700',
  borderWidth: '[1px]',
  boxShadow: 'md',
  padding: '2',
  rounded: 'md',
  transition: '[opacity]',
  transitionDuration: 'fast',
  transitionTimingFunction: 'in-out',
  width: '1/2',
});

const deadEnemyInfo = css({
  opacity: '[0.5]',
});

const enemyName = css({
  marginBottom: '0',
  textAlign: 'right',
});

interface EnemyInfoProps {
  enemy: EnemyAppState;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function EnemyInfo(props: EnemyInfoProps) {
  const lastAttackTime = props.enemy.behaviours.enemyPrimaryAttack?.lastAttackTime ?? 0;
  const attackSpeed = props.enemy.primaryAttack.speed;
  const nextAttackTime = lastAttackTime + 1000 / attackSpeed;

  return (
    <div className={cx(enemyInfo, !props.enemy.isAlive && deadEnemyInfo)}>
      <Heading className={enemyName} level={5}>
        {props.enemy.name}
      </Heading>
      <LifeBar life={props.enemy.life} maxLife={props.enemy.maxLife} />
      <AttackTimerBar
        isAlive={props.enemy.isAlive}
        lastAttackTime={lastAttackTime}
        nextAttackTime={nextAttackTime}
      />
    </div>
  );
}
