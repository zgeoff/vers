interface OptimisticProgressionAvatar {
  readonly level: number;
  readonly xp: number;
}

interface OptimisticProgressionActivity {
  readonly buildSnapshot: { readonly level: number; readonly xp: number };
  readonly id: string;
}

interface OptimisticProgressionSimActivity {
  readonly id: string;
  readonly rewards: { readonly xp: number };
}

interface OptimisticProgressionSimAvatar {
  readonly level: number;
}

interface BuildOptimisticProgressionInput {
  readonly avatar: Readonly<OptimisticProgressionAvatar>;
  readonly currentActivity: Readonly<OptimisticProgressionActivity> | null;
  readonly simActivity?: Readonly<OptimisticProgressionSimActivity> | undefined;
  readonly simAvatar?: Readonly<OptimisticProgressionSimAvatar> | undefined;
}

/**
 * Derives the level/xp a screen renders while an activity is in flight. `buildSnapshot` is the
 * server-authored anchor pinned at the activity's start; the running simulation's level and
 * `rewards.xp` are an optimistic overlay on top of it, applied only while the live sim is still
 * driving that same activity — a stale sim left over from a different one contributes nothing.
 * With no current activity the settled avatar row is the truth: nothing is in flight to
 * optimistically project.
 */
export function buildOptimisticProgression(
  input: Readonly<BuildOptimisticProgressionInput>,
): OptimisticProgressionAvatar {
  if (input.currentActivity === null) {
    return { level: input.avatar.level, xp: input.avatar.xp };
  }

  const simMatchesCurrentActivity = input.simActivity?.id === input.currentActivity.id;

  if (!simMatchesCurrentActivity) {
    return {
      level: input.currentActivity.buildSnapshot.level,
      xp: input.currentActivity.buildSnapshot.xp,
    };
  }

  return {
    level: input.simAvatar?.level ?? input.currentActivity.buildSnapshot.level,
    xp: input.currentActivity.buildSnapshot.xp + (input.simActivity?.rewards.xp ?? 0),
  };
}
