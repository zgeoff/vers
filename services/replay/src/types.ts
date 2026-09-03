import type { ActivityStatus } from '@vers/db';

export interface ClaimedActivity {
  readonly activityID: string;
  readonly avatarID: string;
  readonly priority: number;
  readonly scopeID: string;
  readonly scopeType: string;
}

export interface ReplayTarget {
  readonly activityID: string;
  readonly appendedHead: number;
  readonly replayAttempts: number;
  readonly startChainIndex: number;
  readonly status: ActivityStatus;
  readonly verifiedHead: number;
}

export interface GrantOnce {
  readonly key: string;
  readonly kind: string;
}

export interface SimVersionMismatchPayload {
  readonly data: { readonly providerSimVersion: string };
}

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
