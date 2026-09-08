import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { SimulationDriver } from '@vers/idle-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import type pino from 'pino';
import type { BackoffReason } from '../metrics/record-backoff';

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

export type ParkReason = 'durationCapExceeded' | 'expired' | 'unknownVersion';

export type ReplayIterationOutcome =
  | { readonly kind: 'backedOff'; readonly reason: BackoffReason }
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'matched';
      readonly pendingCache?: { readonly activityID: string; readonly effect: PendingCacheEffect };
    }
  | { readonly kind: 'parked'; readonly reason: ParkReason }
  | { readonly kind: 'quarantined' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'unconfirmedDivergence' };

export interface ReplayWorkerDeps {
  readonly db: Kysely<DB>;

  readonly iterationDeadlineMs?: number;

  readonly keysServiceURL: string;

  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;

  readonly logger: pino.Logger;

  readonly privateKey: CryptoKey;

  readonly simVersion: string;
}
