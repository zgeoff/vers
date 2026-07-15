import type { DB } from '@vers/db';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import type pino from 'pino';

/**
 * What one worker iteration decided for the chain it claimed, or that it found no work.
 */
export type ReplayIterationOutcome =
  | { readonly kind: 'errored' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'matched' }
  | { readonly kind: 'parked'; readonly reason: 'expired' | 'unknownVersion' }
  | { readonly kind: 'quarantined' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'unconfirmedDivergence' };

/**
 * What one worker iteration needs to claim, replay, and adjudicate a chain's frontier.
 */
export interface ReplayWorkerDeps {
  readonly db: Kysely<DB>;
  readonly logger: pino.Logger;

  /**
   * Signs the s2s token a cross-version dispatch to a remote provider carries.
   */
  readonly privateKey: CryptoKey;

  /**
   * This deploy's own baked engine hash — a frontier stamped with it replays in-process; any
   * other stamp routes through the cross-version dispatch.
   */
  readonly simVersion: string;
}

/**
 * A running worker loop's handle: `stop` requests the loop exit after its in-flight iteration
 * finishes (interrupting an idle sleep immediately) and resolves once it has.
 */
export interface ReplayWorkerHandle {
  readonly stop: () => Promise<void>;
}
