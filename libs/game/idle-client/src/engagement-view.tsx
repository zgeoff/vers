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

const encounterRow = css({
  display: 'grid',
  gap: '3',
  gridTemplateColumns: '[repeat(5, minmax(0, 1fr))]',
});

const avatarArea = css({
  maxWidth: '[640px]',
});

/**
 * The engagement screen's live combat view: the mission header, the row of enemy plates for the
 * current wave, and the player's own plate. Enemies render in kill order so the next target reads
 * left-to-right.
 */
export function EngagementView() {
  const activity = useActivity();
  const avatar = useAvatar();

  if (activity === null || avatar === null) {
    return <Spinner />;
  }

  const enemies = activity.currentWave?.enemies.toReversed() ?? [];

  return (
    <div className={view}>
      <MissionHeader activity={activity} />
      <div className={encounterRow}>
        {enemies.map((enemy) => (
          <EnemyUnitPlate enemy={enemy} key={enemy.id} />
        ))}
      </div>
      <div className={avatarArea}>
        <AvatarUnitPlate avatar={avatar} />
      </div>
    </div>
  );
}
