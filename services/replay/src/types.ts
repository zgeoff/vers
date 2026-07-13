import type { ActivityStatus } from '@vers/db';

/**
 * The identity of one `(avatar, chain scope)` seed chain — the unit the replay queue claims and
 * serializes on.
 */
export interface ChainKey {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * A chain claimed for replay: its key plus the queue priority it was picked at. The claim is a row
 * lock — it lasts until the claiming transaction commits or rolls back.
 */
export interface ClaimedChain extends ChainKey {
  readonly priority: number;
}

/**
 * A chain's replay frontier: the oldest activity with appends not yet replayed, and the segment
 * bounds (`verifiedHead + 1 … appendedHead`) the next replay covers.
 */
export interface ReplayFrontier {
  readonly activityID: string;
  readonly appendedHead: number;
  readonly replayAttempts: number;
  readonly startChainIndex: number;
  readonly status: ActivityStatus;
  readonly verifiedHead: number;
}

/**
 * One one-shot grant coordinate: `kind` namespaces the rule (first-clear, achievement,
 * meta-unlock), `key` names the target within it.
 */
export interface GrantOnce {
  readonly key: string;
  readonly kind: string;
}
