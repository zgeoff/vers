import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

/**
 * The wire payload for ingesting a client-minted activity start the server has never seen — the
 * offline-first accept path. It carries only inputs the client alone holds: the chain `seed`, the
 * content and sim versions it simulated under, the `startChainIndex` it anchored at, its predicted
 * `buildSnapshot`, and the `startHash` it folded from them. The encounter node and the key and
 * secret stamps are deliberately absent — the server re-derives those from its own content and
 * scope secret, so a client can never inject them.
 */
export const OfflineActivityStartSubmissionSchema = z.object({
  avatarID: z.string(),
  buildSnapshot: BuildSnapshotSchema,
  contentVersion: z.string().regex(/^\d+$/),

  /**
   * An advisory client-stamped wall-clock timestamp for operator and analytics queries only,
   * never read by the claim or any check.
   */
  playedAt: z.date().nullable(),

  /**
   * The avatar's immediately-prior activity across every chain, null for its first-ever activity.
   * Trusted for sequencing only, never for legality.
   */
  predecessorActivityID: z.string().nullable(),

  scopeID: ScopeIdentifierSchema,
  scopeType: ScopeIdentifierSchema,
  seed: z.string(),
  simVersion: z.string(),
  startChainIndex: z.int().min(0),
  startHash: z.string(),

  /**
   * Idempotency key stamped on the minted row: a resent activity start dedupes on id plus this key,
   * so it converges onto the row it already minted instead of double-minting.
   */
  startKey: z.string().max(128),
});

export type OfflineActivityStartSubmission = z.infer<typeof OfflineActivityStartSubmissionSchema>;
