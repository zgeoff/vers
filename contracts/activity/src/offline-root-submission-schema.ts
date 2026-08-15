import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { EncounterNodeSchema } from './encounter-node-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

/**
 * `advanceActivity`'s ingest of a client-minted activity root the server has never seen — the
 * offline-first accept path. Carries the same start context `startActivity` would have resolved
 * from server truth, computed instead by the client from its cached reveal data and submitted for
 * validation under the exact gates `startActivity` runs: the node must be selectable and the sim
 * version registered, `buildSnapshot` must match what the server re-authors from the avatar's own
 * progression, and `startChainIndex`/`seed` must match the chain's live anchor exactly — a mismatch
 * means the client rooted against a stale head. `startHash` is the client's own recomputation,
 * cross-checked against the server's rather than trusted as the stored value on its own.
 */
export const OfflineRootSubmissionSchema = z.object({
  avatarID: z.string(),
  buildSnapshot: BuildSnapshotSchema,
  contentVersion: z.string(),
  encounterNode: EncounterNodeSchema,
  keyVersion: z.int().min(1),
  scopeID: ScopeIdentifierSchema,
  scopeType: ScopeIdentifierSchema,
  secretRef: z.string(),
  secretVersion: z.int().min(1),
  seed: z.string(),
  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  /**
   * Idempotency key stamped on the minted row — the same role `startActivity`'s own `startKey`
   * plays, required here since a root submission always carries one: dedupe on id plus this key is
   * what makes a resent root mint converge onto the row it already minted instead of double-minting.
   */
  startKey: z.string().max(128),
});

export type OfflineRootSubmission = z.infer<typeof OfflineRootSubmissionSchema>;
