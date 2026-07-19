import { ResourceBar, Sigil } from '@vers/design-system';
import type { EnemySnapshot } from '@vers/idle-core';
import { css, cx } from '@vers/styled-system/css';
import { SwingBar } from './swing-bar';

/**
 * Enemy rarity has no backing state yet, so every hostile reads as Normal until the combat model
 * carries a tier.
 */
const STUB_RARITY_LABEL = 'NORMAL';

const plate = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: '[6px]',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  overflow: 'hidden',
  padding: '3',
  position: 'relative',
});

const deadPlate = css({
  opacity: '[0.45]',
});

const header = css({
  alignItems: 'center',
  color: 'accent.enemy',
  display: 'flex',
  fontFamily: 'mono',
  fontSize: '2xs',
  fontWeight: 'bold',
  justifyContent: 'space-between',
  letterSpacing: '[0.14em]',
});

const levelText = css({
  color: 'text.muted',
});

const portrait = css({
  display: 'flex',
  justifyContent: 'center',
});

const name = css({
  color: 'text.heading',
  fontFamily: 'display',
  fontSize: 'md',
  fontWeight: 'semibold',
  textAlign: 'center',
});

const defeatedOverlay = css({
  alignItems: 'center',
  color: 'text.muted',
  display: 'flex',
  fontFamily: 'display',
  fontSize: '2xs',
  fontWeight: 'bold',
  inset: '[0]',
  justifyContent: 'center',
  letterSpacing: '[0.3em]',
  pointerEvents: 'none',
  position: 'absolute',
});

interface EnemyUnitPlateProps {
  readonly enemy: EnemySnapshot;
}

/**
 * One hostile's frame in the encounter row: crest, identity, life, and its swing timer. A defeated
 * enemy dims and shows a spent marker while it lingers in the lineup.
 */
export function EnemyUnitPlate(props: Readonly<EnemyUnitPlateProps>) {
  const lastAttackTime = props.enemy.behaviours.enemy_primary_attack?.lastAttackTime ?? 0;

  return (
    <div className={cx(plate, !props.enemy.isAlive && deadPlate)}>
      <div className={header}>
        <span>{STUB_RARITY_LABEL}</span>
        <span className={levelText}>LV {props.enemy.level}</span>
      </div>
      <div className={portrait}>
        <Sigil tint="enemy" />
      </div>
      <div className={name}>{props.enemy.name}</div>
      <ResourceBar
        label="LIFE"
        max={props.enemy.maxLife}
        tint="enemy"
        value={props.enemy.life}
        valueLabel={`${props.enemy.life} / ${props.enemy.maxLife}`}
      />
      <SwingBar
        attackSpeed={props.enemy.primaryAttack.speed}
        isAlive={props.enemy.isAlive}
        label="ATTACK"
        lastAttackTime={lastAttackTime}
        tint="enemy"
      />
      {props.enemy.isAlive ? null : <span className={defeatedOverlay}>DEFEATED</span>}
    </div>
  );
}
