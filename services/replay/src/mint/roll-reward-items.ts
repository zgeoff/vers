import { buildPositionStream, getTables, rollItemFromStream } from '@vers/item-gen';
import type { CryptoKey } from 'jose';
import type { RewardFact } from '../replay/types';
import type { MintedItem } from '../types';
import { readAvatarRollKey } from './read-avatar-roll-key';

interface RollRewardItemsDeps {
  readonly keysServiceURL: string;
  readonly privateKey: CryptoKey;
}

interface RollRewardItemsInput {
  readonly avatarID: string;
  readonly contentVersion: string;
  readonly keyVersion: number;
  readonly rewardFacts: ReadonlyArray<RewardFact>;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Rolls every verified reward fact from a segment into its coordinate's content: derives the
 * segment's avatar roll key once, then rolls each fact against it — byte-for-byte identical to
 * re-rolling the same coordinate later, since the interpreter is deterministic in the coordinate,
 * the key, the content version, and the slot context (`nodeTier`) alone. Dispatches to the keys
 * service only when there is something to mint.
 */
export async function rollRewardItems(
  deps: Readonly<RollRewardItemsDeps>,
  input: Readonly<RollRewardItemsInput>,
): Promise<ReadonlyArray<MintedItem>> {
  if (input.rewardFacts.length === 0) {
    return [];
  }

  const rollKey = await readAvatarRollKey(deps, {
    avatarID: input.avatarID,
    keyVersion: input.keyVersion,
  });

  const tables = getTables(input.contentVersion);

  return input.rewardFacts.map((fact) => {
    const stream = buildPositionStream(rollKey, {
      avatarID: input.avatarID,
      chainIndex: fact.chainIndex,
      kind: 'reward',
      ordinal: fact.ordinal,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
    });

    const item = rollItemFromStream(tables, { nodeTier: fact.nodeTier }, stream);

    return {
      affixes: item.affixes,
      avatarID: input.avatarID,
      baseID: item.baseID,
      chainIndex: fact.chainIndex,
      contentVersion: item.contentVersion,
      keyVersion: input.keyVersion,
      ordinal: fact.ordinal,
      rarityID: item.rarityID,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
    };
  });
}
