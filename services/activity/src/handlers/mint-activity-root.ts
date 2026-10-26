import type { BuildSnapshot, EncounterNode } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

interface ActivityRootInput {
  readonly activityID: string;
  readonly avatarID: string;
  readonly buildSnapshot: Readonly<BuildSnapshot>;
  readonly contentVersion: string;
  readonly encounterNode: Readonly<EncounterNode>;
  readonly keyVersion: number;
  readonly playedAt: Date | null;
  readonly predecessorActivityID: null | string;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly secretRef: string;
  readonly secretVersion: number;
  readonly seed: string;
  readonly simVersion: string;
  readonly startChainIndex: number;
  readonly startKey: string;
  readonly writerSessionID: null | string;
}

export function mintActivityRoot(
  trx: Kysely<DB>,
  root: Readonly<ActivityRootInput>,
  admitStartHash?: (startHash: string) => void,
): Promise<Selectable<Activities>> {
  const startHash = buildStartHash({
    contentVersion: root.contentVersion,
    encounterNode: root.encounterNode,
    keyVersion: root.keyVersion,
    seed: root.seed,
    simVersion: root.simVersion,
  });

  admitStartHash?.(startHash);

  return trx
    .insertInto('activities')
    .values({
      avatarId: root.avatarID,
      buildSnapshot: root.buildSnapshot,
      contentVersion: root.contentVersion,
      encounterNode: root.encounterNode,
      id: root.activityID,
      keyVersion: root.keyVersion,
      lastHash: startHash,
      playedAt: root.playedAt,
      predecessorActivityId: root.predecessorActivityID,
      scopeId: root.scopeID,
      scopeType: root.scopeType,
      secretRef: root.secretRef,
      secretVersion: root.secretVersion,
      seed: root.seed,
      simVersion: root.simVersion,
      startChainIndex: root.startChainIndex,
      startHash,
      startKey: root.startKey,
      writerSessionId: root.writerSessionID,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
