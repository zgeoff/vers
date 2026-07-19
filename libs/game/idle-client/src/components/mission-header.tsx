import type { ActivitySnapshot } from '@vers/idle-core';
import { css } from '@vers/styled-system/css';

const header = css({
  alignItems: 'center',
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: '[13px]',
  borderWidth: '[1px]',
  columnGap: '4',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  paddingX: '4',
  paddingY: '3',
});

const title = css({
  color: 'text.heading',
  fontFamily: 'display',
  fontSize: 'sm',
  fontWeight: 'semibold',
  letterSpacing: '[0.06em]',
});

const progress = css({
  color: 'text.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
  letterSpacing: '[0.04em]',
});

const reward = css({
  color: 'accent.self',
  fontFamily: 'mono',
  fontSize: '2xs',
  fontWeight: 'bold',
});

interface MissionHeaderProps {
  readonly activity: ActivitySnapshot;
}

/**
 * The encounter's name and live progress readout — waves cleared of the total, enemies still
 * standing, and experience banked so far.
 */
export function MissionHeader(props: Readonly<MissionHeaderProps>) {
  const totalWaves = props.activity.waves.length;
  const clearedWaves = totalWaves - props.activity.wavesRemaining;

  return (
    <div className={header}>
      <span className={title}>{props.activity.name}</span>
      <span className={progress}>
        {clearedWaves} of {totalWaves} waves cleared · {props.activity.enemiesRemaining} enemies
        left
      </span>
      <span className={reward}>+{props.activity.rewards.xp} XP</span>
    </div>
  );
}
