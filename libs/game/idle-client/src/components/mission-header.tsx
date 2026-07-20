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

const readout = css({
  alignItems: 'baseline',
  columnGap: '4',
  display: 'flex',
  flexWrap: 'wrap',
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

const endRun = css({
  backgroundColor: '[transparent]',
  borderColor: 'border.danger',
  borderRadius: '[8px]',
  borderWidth: '[1px]',
  color: 'text.danger',
  cursor: '[pointer]',
  fontFamily: 'display',
  fontSize: '2xs',
  fontWeight: 'semibold',
  letterSpacing: '[0.1em]',
  paddingX: '3',
  paddingY: '2',
});

interface MissionHeaderProps {
  readonly activity: ActivitySnapshot;
  readonly onEndRun?: () => void;
}

/**
 * The encounter's name and live progress readout — waves cleared of the total, enemies still
 * standing, experience banked so far — with the run's exit anchored to the right.
 */
export function MissionHeader(props: Readonly<MissionHeaderProps>) {
  const totalWaves = props.activity.waves.length;
  const clearedWaves = totalWaves - props.activity.wavesRemaining;

  return (
    <div className={header}>
      <div className={readout}>
        <span className={title}>{props.activity.name}</span>
        <span className={progress}>
          {clearedWaves} of {totalWaves} waves cleared · {props.activity.enemiesRemaining} enemies
          left
        </span>
        <span className={reward}>+{props.activity.rewards.xp} XP</span>
      </div>
      {props.onEndRun === undefined ? null : (
        <button className={endRun} onClick={props.onEndRun} type="button">
          END RUN
        </button>
      )}
    </div>
  );
}
