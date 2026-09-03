import { useQuery } from '@tanstack/react-query';
import { Text } from '@vers/design-system';
import { buildAvatarProgressionQueryOptions } from '../../lib/activity/build-avatar-progression-query-options';
import { buildOptimisticProgression } from '../../lib/activity/build-optimistic-progression';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

export function AvatarProgression() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatar = avatarQuery.data;

  const progressionQuery = useQuery({
    ...buildAvatarProgressionQueryOptions(avatar?.id ?? ''),
    enabled: avatar !== null && avatar !== undefined,
  });

  if (avatar === null || avatar === undefined) {
    return null;
  }

  const settled = progressionQuery.data;

  const progression = buildOptimisticProgression({
    // the avatar row alone while the read is still in flight, so the screen shows a total
    // immediately rather than nothing
    progression: settled ?? { level: avatar.level, pending: [], xp: avatar.xp },
    // that row carries no per-activity settled total for the live overlay to net against, so
    // projecting the sim on top of it would count the banked part twice and then correct downward
    // once the read lands
    simActivity: settled ? idleWorkerHandle.activity : undefined,
  });

  return (
    <>
      <Text data-testid="avatar-level">Level {progression.level}</Text>
      <Text data-testid="avatar-xp">XP: {progression.xp}</Text>
      {progression.isSettling && <Text data-testid="avatar-progression-settling">Settling…</Text>}
    </>
  );
}
