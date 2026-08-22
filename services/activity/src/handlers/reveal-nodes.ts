import { findCurrentContentVersion } from '@vers/content-registry';
import type { ContentDocument, EncounterNode } from '@vers/contract-activity';
import { createGenesisSeed } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { deriveWorldmapContent, readScopeSecret } from '@vers/worldmap-content';
import { canEncodeMortonKey } from '@vers/worldmap-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { recordRevealMint } from '../metrics/record-reveal-mint';
import { requireActiveAvatar } from '../require-active-avatar';
import { resolveEncounterNode } from '../resolve-encounter-node';
import type { AvatarNotActivePayload, EmptyErrorPayload, MissingSessionPayload } from '../types';

interface RevealNodesDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly keyVersion: number;
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

interface RevealedNodeAnchor {
  readonly chainIndex: number;
  readonly nextSeed: string;
}

interface RevealedNode {
  readonly contentVersion: string;
  readonly encounterNode: EncounterNode;
  readonly genesisSeed: string;
  readonly anchor: RevealedNodeAnchor;
  readonly nodeID: string;
}

interface RevealNodesResult {
  readonly keyVersion: number;
  readonly nodes: Array<RevealedNode>;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

/**
 * Mints (or re-affirms) the genesis chain row for each given world-map node, on behalf of an avatar
 * owned by the acting user, and derives that node's encounter alongside the current content version
 * — every crypto stamp a later offline-open `startActivity` needs to synthesize a valid start
 * without the server. Idempotent per node: a repeat reveal self-assigns the existing row's
 * `genesisSeed` in place of rolling a new one, so a node reveals to the same seed regardless of how
 * many times, or how many concurrent callers, reveal it — the property `startActivity` later
 * activity starts against. A duplicate node id within one call mints once; every requested id,
 * repeats included, still gets one result entry. The stamps (`keyVersion`, `secretRef`,
 * `secretVersion`) are avatar- and account-global, so the response carries them once rather than
 * per node. Rejects with NODE_UNKNOWN before minting anything when any node id doesn't resolve to a
 * coordinate the world map can address. Authorization is ownership of the avatar, gated to the
 * account's active avatar under the same advisory lock `startActivity` takes — the active-avatar
 * check runs even for an empty batch, so an owned-but-inactive avatar is rejected regardless of how
 * many nodes it reveals. Which nodes this avatar may legitimately reveal is a separate,
 * not-yet-enforced concern.
 */
export async function revealNodes(
  deps: RevealNodesDeps,
  opts: RevealNodesOpts,
): Promise<RevealNodesResult> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .select(['id', 'seed'])
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const resolvedByNodeID = new Map<string, { coord: [number, number]; difficulty: number }>();

  for (const nodeID of opts.input.nodeIDs) {
    const resolved = resolveEncounterNode('world_map_node', nodeID);

    if (resolved === undefined || !canEncodeMortonKey(resolved.coord)) {
      throw opts.errors.NODE_UNKNOWN({ data: {} });
    }

    resolvedByNodeID.set(nodeID, resolved);
  }

  const uniqueNodeIDs = [...new Set(opts.input.nodeIDs)];

  const minted = await deps.db.transaction().execute(async (trx) => {
    await requireActiveAvatar(trx, actingUserID, opts.input.avatarID, opts.errors);

    if (uniqueNodeIDs.length === 0) {
      return [];
    }

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
      .returning(['scopeId', 'genesisSeed', 'appendedNextSeed', 'appendedChainIndex'])
      .execute();
  });

  if (uniqueNodeIDs.length === 0) {
    return {
      keyVersion: deps.keyVersion,
      nodes: [],
      secretRef: deps.secretRef,
      secretVersion: deps.secretVersion,
    };
  }

  recordRevealMint(uniqueNodeIDs.length);

  // Loaded only after the mint transaction's active-avatar gate, so an owned-but-inactive avatar
  // rejects before this reveal pays for the content-registry read or the keys round trip.
  const encounterInputs = await loadEncounterInputs(deps, avatar.id);

  const mintedByNodeID = new Map(minted.map((row) => [row.scopeId, row]));

  const nodes = opts.input.nodeIDs.map((nodeID): RevealedNode => {
    const chain = mintedByNodeID.get(nodeID);

    invariant(chain !== undefined, 'minted chain row missing for a requested node');

    const resolved = resolvedByNodeID.get(nodeID);

    invariant(resolved !== undefined, 'validated node id missing its resolved encounter');

    const encounterNode = {
      difficulty: resolved.difficulty,
      ...deriveWorldmapContent(encounterInputs.document.encounter, {
        coord: resolved.coord,
        scopeSecret: encounterInputs.scopeSecret,
        userSeed: avatar.seed,
      }),
    };

    return {
      contentVersion: encounterInputs.contentVersion,
      encounterNode,
      genesisSeed: chain.genesisSeed,
      anchor: { chainIndex: chain.appendedChainIndex, nextSeed: chain.appendedNextSeed },
      nodeID,
    };
  });

  return {
    keyVersion: deps.keyVersion,
    nodes,
    secretRef: deps.secretRef,
    secretVersion: deps.secretVersion,
  };
}

interface EncounterInputs {
  readonly contentVersion: string;
  readonly document: ContentDocument;
  readonly scopeSecret: Uint8Array;
}

async function loadEncounterInputs(
  deps: RevealNodesDeps,
  avatarID: string,
): Promise<EncounterInputs> {
  const contentVersion = await findCurrentContentVersion(deps.db);

  invariant(contentVersion !== undefined, 'content registry has no current version');

  const document = await deps.loadContentDocument(contentVersion);

  invariant(document, `current content version ${contentVersion} is not published`);

  const scopeSecret = await readScopeSecret(
    {
      issuer: 'service-activity',
      keysServiceURL: deps.keysServiceURL,
      privateKey: deps.privateKey,
    },
    { avatarID, secretRef: deps.secretRef, secretVersion: deps.secretVersion },
  );

  return { contentVersion, document, scopeSecret };
}
