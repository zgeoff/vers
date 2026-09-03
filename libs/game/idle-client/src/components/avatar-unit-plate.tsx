import { ResourceBar, Sigil, StatusPill } from '@vers/design-system';
import type { AvatarSnapshot } from '@vers/idle-core';
import { css } from '@vers/styled-system/css';
import { SwingBar } from './swing-bar';

const STUB_DISCIPLINE = 'WARD · AEGIS DISCIPLINE';
const STUB_BARRIER_FRACTION = 0.25;
const STUB_AETHER = { max: 1600, value: 1024 };
const STUB_BUFFS = ['Fortified', 'Aegis Ward'];
const STUB_DEBUFFS = ['Chilled'];
const STUB_ABILITY_SLOTS = [0, 1, 2, 3, 4, 5];

const plate = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: '[6px]',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  padding: '4',
});

const identity = css({
  alignItems: 'center',
  display: 'flex',
  gap: '3',
});

const nameText = css({
  color: 'text.heading',
  fontFamily: 'display',
  fontSize: 'lg',
  fontWeight: 'semibold',
});

const disciplineText = css({
  color: 'accent.self',
  fontFamily: 'mono',
  fontSize: '2xs',
  letterSpacing: '[0.04em]',
});

const levelBadge = css({
  borderColor: 'accent.self',
  borderRadius: '[4px]',
  borderWidth: '[1px]',
  color: 'accent.self',
  fontFamily: 'mono',
  fontSize: '2xs',
  fontWeight: 'bold',
  marginLeft: 'auto',
  paddingX: '2',
  paddingY: '1',
});

const statusRow = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1',
});

const abilityRow = css({
  display: 'flex',
  gap: '2',
});

const abilitySlot = css({
  aspectRatio: '[1]',
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderRadius: '[8px]',
  borderWidth: '[1px]',
  flex: '1',
  maxWidth: '[40px]',
});

interface AvatarUnitPlateProps {
  readonly avatar: AvatarSnapshot;
  readonly displayName?: string;
}

export function AvatarUnitPlate(props: Readonly<AvatarUnitPlateProps>) {
  const lastAttackTime = props.avatar.behaviours.avatar_weapon_attack?.lastAttackTime ?? 0;

  return (
    <div className={plate}>
      <div className={identity}>
        <Sigil size={48} tint="self" />
        <div>
          <div className={nameText}>{props.displayName ?? props.avatar.name}</div>
          <div className={disciplineText}>{STUB_DISCIPLINE}</div>
        </div>
        <span className={levelBadge}>LV {props.avatar.level}</span>
      </div>

      <ResourceBar
        label="LIFE"
        max={props.avatar.maxLife}
        tint="self"
        value={props.avatar.life}
        valueLabel={`${props.avatar.life} / ${props.avatar.maxLife}`}
      >
        <ResourceBar.Overlay
          max={props.avatar.maxLife}
          tint="barrier"
          value={props.avatar.maxLife * STUB_BARRIER_FRACTION}
        />
      </ResourceBar>

      <ResourceBar
        label="AETHER"
        max={STUB_AETHER.max}
        size="sm"
        tint="aether"
        value={STUB_AETHER.value}
      />

      <SwingBar
        attackSpeed={props.avatar.mainHandAttack?.speed ?? 0}
        isAlive={props.avatar.isAlive}
        label="STRIKE"
        lastAttackTime={lastAttackTime}
        tint="self"
      />

      <div className={statusRow}>
        {STUB_BUFFS.map((buff) => (
          <StatusPill key={buff} kind="buff" name={buff} />
        ))}
        {STUB_DEBUFFS.map((debuff) => (
          <StatusPill key={debuff} kind="debuff" name={debuff} />
        ))}
      </div>

      <div className={abilityRow}>
        {STUB_ABILITY_SLOTS.map((slot) => (
          <div className={abilitySlot} key={slot} />
        ))}
      </div>
    </div>
  );
}
