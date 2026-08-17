import { isDefinedError, safe } from '@orpc/client';
import type { WorkerContext } from './types';

interface TryStartActivityInput {
  readonly avatarID: string;

  /**
   * The avatar's immediately-prior activity — the terminal row this start continues from. Absent
   * only when no such row exists (an origin start through this online path); every continuation
   * start names it.
   */
  readonly predecessorActivityID?: string | undefined;

  readonly scopeID: string;
  readonly scopeType: string;
  readonly startKey: string;
}

/**
 * One start-activity mint pinned to the build's bundled engine hash, deliberately unsigned: the
 * response is the only handle on the minted row, and a caller's stop-back compensation needs it.
 * SIM_VERSION_UNKNOWN on the bundled hash retries once with no hash at all, falling back onto the
 * registry's current stamp — during a deploy the app bundle can bake a hash whose registry row
 * the replay rollout hasn't written yet, and that lag is not this build's engine being stale.
 * Stamps `playedAt` fresh on every attempt, including the retry — an advisory timestamp, not a
 * value replay ever checks.
 */
export async function tryStartActivity(
  context: WorkerContext,
  input: Readonly<TryStartActivityInput>,
) {
  const first = await safe(
    context.getClient().startActivity({
      avatarID: input.avatarID,
      playedAt: new Date(),
      predecessorActivityID: input.predecessorActivityID ?? null,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
      simVersion: context.getBundledEngineHash(),
      startKey: input.startKey,
    }),
  );

  if (!isDefinedError(first[0]) || first[0].code !== 'SIM_VERSION_UNKNOWN') {
    return first;
  }

  return safe(
    context.getClient().startActivity({
      avatarID: input.avatarID,
      playedAt: new Date(),
      predecessorActivityID: input.predecessorActivityID ?? null,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
      startKey: input.startKey,
    }),
  );
}
