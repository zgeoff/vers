import { buildLevelFromXP } from '@vers/idle-core';

interface PendingXPEntry {
  readonly activityID: string;
  readonly xpDelta: number;
}

interface ActiveXPEntry {
  readonly activityID: string;
  readonly settledXP: number;
}

interface OptimisticProgressionRead {
  readonly active?: ActiveXPEntry | null | undefined;
  readonly level: number;
  readonly pending: ReadonlyArray<PendingXPEntry>;
  readonly xp: number;
}

interface OptimisticProgressionSimActivity {
  readonly id: string;
  readonly rewards: { readonly xp: number };
}

interface BuildOptimisticProgressionInput {
  readonly progression: Readonly<OptimisticProgressionRead>;
  readonly simActivity?: Readonly<OptimisticProgressionSimActivity> | undefined;
}

interface OptimisticProgression {
  /**
   * Whether the displayed total carries anything not yet on the settled row: a pending entry, a
   * live sim overlay, or both. A screen renders its settling marker exactly when this is true.
   */
  readonly isSettling: boolean;
  readonly level: number;
  readonly xp: number;
}

/**
 * Derives the level/xp a screen renders from the settled progression read: the settled total plus
 * every pending entry's delta, plus the live sim's own running delta on top — deduped by activity
 * id against the pending list so a just-terminal run's own entry, once its refetch lands, is never
 * counted twice. The live overlay is net of whatever the settled total already carries for that
 * same run, so a settled row that tracks a run in flight never double-counts its verified part;
 * checkpoints still queued client-side only widen that remainder, never invert it. The level is
 * recomputed from the resulting total whenever anything is projected — a pending entry can carry
 * xp from a run the live sim never drove, so only the aggregate total derives a trustworthy level;
 * the settled row's own level is exact only once nothing projects on top of it.
 */
export function buildOptimisticProgression(
  input: Readonly<BuildOptimisticProgressionInput>,
): OptimisticProgression {
  const pendingXP = input.progression.pending.reduce((total, entry) => total + entry.xpDelta, 0);

  const simIsPending = input.progression.pending.some(
    (entry) => entry.activityID === input.simActivity?.id,
  );

  const liveActivityID = input.progression.active?.activityID;
  const simIsLive = liveActivityID === input.simActivity?.id;

  // A run other than the sim's is live, so the sim is a stale worker snapshot of a run that has
  // already been displaced — its total belongs to nothing the settled row is still tracking. No
  // live run at all leaves the overlay standing, covering the window between a terminal append
  // and the pending entry that replaces it.
  const simIsStale = liveActivityID !== undefined && !simIsLive;
  const overlayApplies = input.simActivity !== undefined && !simIsPending && !simIsStale;
  const settledForSim = simIsLive ? (input.progression.active?.settledXP ?? 0) : 0;

  const overlayXP = overlayApplies
    ? Math.max(0, (input.simActivity?.rewards.xp ?? 0) - settledForSim)
    : 0;

  const displayXP = input.progression.xp + pendingXP + overlayXP;
  const isSettling = input.progression.pending.length > 0 || overlayApplies;

  return {
    isSettling,
    level: isSettling ? buildLevelFromXP(displayXP) : input.progression.level,
    xp: displayXP,
  };
}
