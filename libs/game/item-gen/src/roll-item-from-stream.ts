import type { RollStream } from '@vers/roll-crypto';
import invariant from 'tiny-invariant';
import type { ItemInterpreters, LootTables, RolledItem, SlotContext } from './types';

export function rollItemFromStream(
  interpreters: ItemInterpreters,
  tables: Readonly<LootTables>,
  context: Readonly<SlotContext>,
  stream: RollStream,
): RolledItem {
  const interpreter = interpreters[tables.contentVersion];

  invariant(interpreter, `no item interpreter for content version ${tables.contentVersion}`);

  return interpreter(tables, context, stream);
}
