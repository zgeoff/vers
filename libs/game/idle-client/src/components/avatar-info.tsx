import { Heading } from '@vers/design-system';
import type { AvatarAppState } from '@vers/idle-core';
import { AttackTimerBar } from './attack-timer-bar';
import * as styles from './avatar-info.styles';
import { LifeBar } from './life-bar';

interface AvatarInfoProps {
  avatar: AvatarAppState;
}

export function AvatarInfo(props: Readonly<AvatarInfoProps>) {
  const lastAttackTime = props.avatar.behaviours.avatarWeaponAttack?.lastAttackTime ?? 0;
  const attackSpeed = props.avatar.mainHandAttack?.speed ?? 0;
  const nextAttackTime = lastAttackTime + 1000 / attackSpeed;

  return (
    <div className={styles.avatarInfo}>
      <Heading className={styles.avatarName} level={4}>
        {props.avatar.name}
      </Heading>
      <LifeBar life={props.avatar.life} maxLife={props.avatar.maxLife} />
      <AttackTimerBar
        isAlive={props.avatar.isAlive}
        lastAttackTime={lastAttackTime}
        nextAttackTime={nextAttackTime}
      />
    </div>
  );
}
