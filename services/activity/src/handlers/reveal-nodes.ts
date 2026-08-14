import type { ContentDocument } from '@vers/contract-activity';
import { createGenesisSeed } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { canEncodeMortonKey, findCellCoord } from '@vers/worldmap-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { recordRevealMint } from '../metrics/record-reveal-mint';
import { requireActiveAvatar } from '../require-active-avatar';
import type { AvatarNotActivePayload, EmptyErrorPayload, MissingSessionPayload } from '../types';

/**
 * Db handle plus the memoized content-document loader and keys dispatch a reveal query reads its
 * scope secret over — the same dependency shape `getRevealedNodes` closes over, minus the key
 * version and signing inputs a read never stamps.
 */
interface RevealNodesDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

/**
 * oRPC handler opts for the authed `revealNodes` procedure.
 */
interface RevealNodesOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
    readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly nodeIDs: ReadonlyArray<string>;
  };
}

interface NodeGenesis {
  readonly genesisSeed: string;
  readonly nodeID: string;
}

/**
 * Mints (or re-affirms) the genesis chain row for each given world-map node, on behalf of an
 * avatar owned by the acting user. Idempotent per node: a repeat reveal self-assigns the existing
 * row's `genesisSeed` in place of rolling a new one, so a node reveals to the same seed regardless
 * of how many times, or how many concurrent callers, reveal it — the property `startActivity`
 * later roots against. A duplicate node id within one call mints once; every requested id, repeats
 * included, still gets one result entry. Rejects with NODE_UNKNOWN before minting anything when any
 * node id doesn't resolve to a coordinate the world map can address. Authorization is ownership of
 * the avatar, gated to the account's active avatar under the same advisory lock `startActivity`
 * takes — which nodes this avatar may legitimately reveal is a separate, not-yet-enforced concern.
 */
export async function revealNodes(
  deps: RevealNodesDeps,
  opts: RevealNodesOpts,
): Promise<Array<NodeGenesis>> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .select('id')
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  for (const nodeID of opts.input.nodeIDs) {
    const coord = findCellCoord(nodeID);

    if (coord === undefined || !canEncodeMortonKey(coord)) {
      throw opts.errors.NODE_UNKNOWN({ data: {} });
    }
  }

  if (opts.input.nodeIDs.length === 0) {
    return [];
  }

  const uniqueNodeIDs = [...new Set(opts.input.nodeIDs)];

  const minted = await deps.db.transaction().execute(async (trx) => {
    await requireActiveAvatar(trx, actingUserID, opts.input.avatarID, opts.errors);

    return trx
      .insertInto('activityChains')
      .values(
        uniqueNodeIDs.map((nodeID) => {
          const genesisSeed = createGenesisSeed();

          return {
            appendedNextSeed: genesisSeed,
            avatarId: opts.input.avatarID,
            genesisSeed,
            scopeId: nodeID,
            scopeType: 'world_map_node' as const,
            verifiedNextSeed: genesisSeed,
          };
        }),
      )
      .onConflict((oc) =>
        oc
          .columns(['avatarId', 'scopeType', 'scopeId'])
          .doUpdateSet({ genesisSeed: (eb) => eb.ref('activityChains.genesisSeed') }),
      )
      .returning(['scopeId', 'genesisSeed'])
      .execute();
  });

  recordRevealMint(uniqueNodeIDs.length);

  const genesisByNodeID = new Map(minted.map((row) => [row.scopeId, row.genesisSeed]));

  return opts.input.nodeIDs.map((nodeID) => {
    const genesisSeed = genesisByNodeID.get(nodeID);

    invariant(genesisSeed !== undefined, 'minted chain row missing for a requested node');

    return { genesisSeed, nodeID };
  });
}
