import { Spinner } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { AvatarUnitPlate } from './components/avatar-unit-plate';
import { EnemyUnitPlate } from './components/enemy-unit-plate';
import { MissionHeader } from './components/mission-header';
import { useActivity } from './state/use-activity';
import { useAvatar } from './state/use-avatar';

const view = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  userSelect: 'none',
  width: 'full',
});

/**
 * A wave holds at most six enemies, so each plate is capped at a sixth of the row (minus the five
 * gaps between six) and the group centres — a short wave stays plate-sized instead of stretching.
 */
const encounterRow = css({
  '& > *': { flex: '1', maxWidth: '[calc((100% - 3.75rem) / 6)]', minWidth: '0' },
  alignItems: 'stretch',
  display: 'flex',
  gap: '3',
  justifyContent: 'center',
});

const avatarArea = css({
  maxWidth: '[640px]',
});

interface EngagementViewProps {
  readonly avatarName?: string;
  readonly onEndRun?: () => void;
}

/**
 * The engagement screen's live combat view: the mission header, the row of enemy plates for the
 * current wave, and the player's own plate. Enemies render in kill order so the next target reads
 * left-to-right.
 */
export function EngagementView(props: Readonly<EngagementViewProps>) {
  const activity = useActivity();
  const avatar = useAvatar();

  if (activity === null || avatar === null) {
    return <Spinner />;
  }

  const enemies = activity.currentWave?.enemies.toReversed() ?? [];

  return (
    <div className={view}>
      <MissionHeader activity={activity} {...(props.onEndRun && { onEndRun: props.onEndRun })} />
      <div className={encounterRow}>
        {enemies.map((enemy) => (
          <EnemyUnitPlate enemy={enemy} key={enemy.id} />
        ))}
      </div>
      <div className={avatarArea}>
        <AvatarUnitPlate
          avatar={avatar}
          {...(props.avatarName !== undefined && { displayName: props.avatarName })}
        />
      </div>
    </div>
  );
}
