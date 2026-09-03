import { findCurrentContentVersion } from '@vers/content-registry';
import type { ContentDocument } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { deriveWorldmapContent, readScopeSecret } from '@vers/worldmap-content';
import {
  buildRevealSources,
  collectRevealedCells,
  decodeMortonKey,
  findCellCoord,
  toNodeID,
} from '@vers/worldmap-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { recordRevealQuery } from '../metrics/record-reveal-query';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface GetRevealedNodesDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

interface GetRevealedNodesOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly viewport: {
      readonly maxCX: number;
      readonly maxCY: number;
      readonly minCX: number;
      readonly minCY: number;
    };
  };
}

interface RevealedNode {
  readonly id: string;
  readonly poolID?: string;
}

interface GetRevealedNodesResult {
  readonly completedNodeIDs: Array<string>;
  readonly contentVersion: string;
  readonly nodes: Array<RevealedNode>;
}

export async function getRevealedNodes(
  deps: GetRevealedNodesDeps,
  opts: GetRevealedNodesOpts,
): Promise<GetRevealedNodesResult> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .select(['id', 'seed'])
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', opts.context.actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const grants = await deps.db
    .selectFrom('avatarGrants')
    .select('key')
    .where('avatarId', '=', avatar.id)
    .where('kind', '=', 'first_clear')
    .execute();

  const completedNodeIDs: Array<string> = [];

  for (const grant of grants) {
    if (findCellCoord(grant.key) !== undefined) {
      completedNodeIDs.push(grant.key);
    }
  }

  const sources = buildRevealSources(new Set(completedNodeIDs));
  const revealedCells = collectRevealedCells(sources, opts.input.viewport);

  const contentVersion = await findCurrentContentVersion(deps.db);

  invariant(contentVersion !== undefined, 'content registry has no current version');

  // a viewport the discs never reach needs neither the content document nor the avatar's scope
  // secret, so a fog-only query costs one grants read and no keys-service round trip; the
  // completed set is never viewport-clipped, so it is still returned in full
  if (revealedCells.length === 0) {
    recordRevealQuery({ cellCount: 0, sourceCount: grants.length });

    return { completedNodeIDs, contentVersion, nodes: [] };
  }

  const document = await deps.loadContentDocument(contentVersion);

  invariant(document, `current content version ${contentVersion} is not published`);

  const scopeSecret = await readScopeSecret(
    {
      issuer: 'service-activity',
      keysServiceURL: deps.keysServiceURL,
      privateKey: deps.privateKey,
    },
    { avatarID: avatar.id, secretRef: deps.secretRef, secretVersion: deps.secretVersion },
  );

  const nodes = revealedCells.map((key): RevealedNode => {
    const coord = decodeMortonKey(key);

    const content = deriveWorldmapContent(document.encounter, {
      coord,
      scopeSecret,
      userSeed: avatar.seed,
    });

    const id = toNodeID(coord[0], coord[1]);

    return content.poolID === undefined ? { id } : { id, poolID: content.poolID };
  });

  recordRevealQuery({ cellCount: nodes.length, sourceCount: grants.length });

  return { completedNodeIDs, contentVersion, nodes };
}
