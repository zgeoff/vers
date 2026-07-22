import type { DB } from '@vers/db';
import type { SimulationDriver } from '@vers/idle-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import type pino from 'pino';

/**
 * The cache mutation `applyMatch` intends for a matched, non-terminal segment, applied only after
 * the iteration's transaction has committed — the cache must never advance ahead of what actually
 * persisted.
 */
export type PendingCacheEffect =
  | { readonly kind: 'evict' }
  | {
      readonly entry: {
        readonly driver: SimulationDriver;
        readonly emittedCount: number;
        readonly lastHash: string;
      };
      readonly kind: 'set';
    };

/**
 * What one worker iteration decided for the chain it claimed, or that it found no work.
 */
export type ReplayIterationOutcome =
  | { readonly kind: 'errored' }
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'matched';
      readonly pendingCache?: { readonly activityID: string; readonly effect: PendingCacheEffect };
    }
  | {
      readonly kind: 'parked';
      readonly reason: 'durationCapExceeded' | 'expired' | 'providerUnavailable' | 'unknownVersion';
    }
  | { readonly kind: 'quarantined' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'unconfirmedDivergence' };

/**
 * What one worker iteration needs to claim, replay, and adjudicate a chain's frontier.
 */
export interface ReplayWorkerDeps {
  readonly db: Kysely<DB>;

  /**
   * The keys service origin the mint step derives a segment's avatar roll key from.
   */
  readonly keysServiceURL: string;
  readonly logger: pino.Logger;

  /**
   * Signs the s2s token a cross-version dispatch to a remote provider, or a mint's derive-key
   * dispatch to the keys service, carries.
   */
  readonly privateKey: CryptoKey;

  /**
   * This deploy's own baked engine hash — a frontier stamped with it replays in-process; any
   * other stamp routes through the cross-version dispatch.
   */
  readonly simVersion: string;
}
