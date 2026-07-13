import { Heading } from '@vers/design-system';
import type { EnemySnapshot } from '@vers/idle-core';
import { css, cx } from '@vers/styled-system/css';
import { AttackTimerBar } from './attack-timer-bar';
import { LifeBar } from './life-bar';

const enemyInfo = css({
  _last: {
    marginBottom: '0',
  },
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  padding: '2',
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
  enemy: EnemySnapshot;
}

export function EnemyInfo(props: Readonly<EnemyInfoProps>) {
  const lastAttackTime = props.enemy.behaviours.enemy_primary_attack?.lastAttackTime ?? 0;
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
