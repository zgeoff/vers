import { buildPositionStream, rollItemFromStream } from '@vers/item-gen';
import type { LootTables } from '@vers/item-gen';
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
  readonly keyVersion: number;
  readonly rewardFacts: ReadonlyArray<RewardFact>;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly tables: Readonly<LootTables>;
}

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

  return input.rewardFacts.map((fact) => {
    const stream = buildPositionStream(rollKey, {
      avatarID: input.avatarID,
      chainIndex: fact.chainIndex,
      kind: 'reward',
      ordinal: fact.ordinal,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
    });

    const item = rollItemFromStream(input.tables, { nodeTier: fact.nodeTier }, stream);

    return {
      affixes: item.affixes,
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
