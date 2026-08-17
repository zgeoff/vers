import type { ActivityStatus } from '@vers/db';

/**
 * An avatar's next-in-order activity claimed for replay: the activity id itself, the chain scope it
 * belongs to, and the queue priority it was picked at. The claim is a row lock on that chain — it
 * lasts until the claiming transaction commits or rolls back.
 */
export interface ClaimedActivity {
  readonly activityID: string;
  readonly avatarID: string;
  readonly priority: number;
  readonly scopeID: string;
  readonly scopeType: string;
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

/**
 * Payload shape for `replaySegment`'s SIM_VERSION_MISMATCH: the provider's own baked engine hash,
 * so the caller can tell which version actually answered.
 */
export interface SimVersionMismatchPayload {
  readonly data: { readonly providerSimVersion: string };
}

/**
 * One rolled reward, ready for an `avatar_items` insert. The coordinate columns
 * (`avatarId`/`scopeType`/`scopeId`/`chainIndex`/`ordinal`) are the row's identity, so an
 * `ON CONFLICT DO NOTHING` insert makes re-minting the same fact idempotent. The owning avatar is
 * not carried here — a minted row belongs to the avatar whose verified segment is being applied,
 * supplied at the insert.
 */
export interface MintedItem {
  readonly affixes: ReadonlyArray<{
    readonly affixID: string;
    readonly groupID: string;
    readonly value: number;
  }>;
  readonly baseID: string;
  readonly chainIndex: number;
  readonly contentVersion: string;
  readonly keyVersion: number;
  readonly ordinal: number;
  readonly rarityID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}
