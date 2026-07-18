import { useQuery } from '@tanstack/react-query';
import { Text } from '@vers/design-system';
import { buildAvatarProgressionQueryOptions } from '../../lib/activity/build-avatar-progression-query-options';
import { buildOptimisticProgression } from '../../lib/activity/build-optimistic-progression';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Client island rendering the avatar's level and xp: the settled row plus every pending
 * terminal-but-unsettled activity's delta, plus an in-flight activity's own running delta on top —
 * with a settling marker while anything is still projected onto the settled row.
 */
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

  // Settled row from the query once it resolves; the avatar row alone with no pending entries
  // while it's still loading, so the screen shows a total immediately rather than nothing.
  const settled = progressionQuery.data ?? { level: avatar.level, pending: [], xp: avatar.xp };

  const progression = buildOptimisticProgression({
    progression: settled,
    simActivity: idleWorkerHandle.activity,
  });

  return (
    <>
      <Text data-testid="avatar-level">Level {progression.level}</Text>
      <Text data-testid="avatar-xp">XP: {progression.xp}</Text>
      {progression.isSettling && <Text data-testid="avatar-progression-settling">Settling…</Text>}
    </>
  );
}
