import * as z from 'zod';
import { BuildSnapshotSchema } from './build-snapshot-schema';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

/**
 * `advanceActivity`'s ingest of a client-minted activity root the server has never seen — the
 * offline-first accept path. Carries the start context the client computed offline from its cached
 * reveal data, submitted for validation under the exact gates `startActivity` runs.
 *
 * The client submits only what it alone holds: the chain `seed`, the content and sim versions it
 * simulated under, the `startChainIndex` it rooted at, its predicted `buildSnapshot`, and the
 * `startHash` it folded from them. The encounter node and the key/secret stamps are never
 * submitted — the server re-derives them from its own content document and scope secret exactly as
 * a fresh start does, so a poisoned encounter or stamp can never enter the row.
 *
 * `startHash` is the client's own recomputation, required to equal the hash the server folds from
 * its server-derived inputs rather than trusted as the stored value on its own — proof the client
 * simulated against the same content and encounter the server derives from its own truth.
 * `contentVersion` is a numeric string, the form the content registry publishes, so a nonnumeric
 * version is a typed schema rejection rather than a downstream failure.
 */
export const OfflineRootSubmissionSchema = z.object({
  avatarID: z.string(),
  buildSnapshot: BuildSnapshotSchema,
  contentVersion: z.string().regex(/^\d+$/),
  scopeID: ScopeIdentifierSchema,
  scopeType: ScopeIdentifierSchema,
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
