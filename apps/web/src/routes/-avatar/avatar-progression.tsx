import { useQuery } from '@tanstack/react-query';
import { Text } from '@vers/design-system';
import { buildOptimisticProgression } from '../../lib/activity/build-optimistic-progression';
import { currentActivityQueryOptions } from '../../lib/activity/current-activity-query-options';
import { activeAvatarQueryOptions } from '../../lib/avatar/active-avatar-query-options';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Client island rendering the avatar's level and xp: an in-flight activity's optimistic delta on
 * top of the settled anchor, or the settled row directly once nothing is running.
 */
export function AvatarProgression() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const avatarQuery = useQuery(activeAvatarQueryOptions());
  const avatar = avatarQuery.data;

  const currentActivityQuery = useQuery({
    ...currentActivityQueryOptions(avatar?.id ?? ''),
    enabled: avatar !== null && avatar !== undefined,
  });

  if (avatar === null || avatar === undefined) {
    return null;
  }

  const progression = buildOptimisticProgression({
    avatar,
    currentActivity: currentActivityQuery.data ?? null,
    simActivity: idleWorkerHandle.activity,
    simAvatar: idleWorkerHandle.avatar,
  });

  return (
    <>
      <Text data-testid="avatar-level">Level {progression.level}</Text>
      <Text data-testid="avatar-xp">XP: {progression.xp}</Text>
    </>
  );
}
