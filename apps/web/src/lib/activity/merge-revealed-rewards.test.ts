import { expect, test } from 'bun:test';
import { mergeRevealedRewards } from './merge-revealed-rewards';

test('it accumulates a fresh page onto the previous one', () => {
  const previous = {
    items: [
      {
        chainIndex: 1,
        item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
        ordinal: 0,
      },
    ],
    verifiedHead: 1,
  };

  const page = {
    items: [
      {
        chainIndex: 2,
        item: { affixes: [], baseID: 'base_2', contentVersion: '1', rarityID: 'common' },
        ordinal: 0,
      },
    ],
    verifiedHead: 2,
  };

  const result = mergeRevealedRewards(previous, page);

  expect(result).toStrictEqual({
    items: [...previous.items, ...page.items],
    verifiedHead: 2,
  });
});

test('it dedupes on the (chainIndex, ordinal) coordinate, preferring the fresher page', () => {
  const previous = {
    items: [
      {
        chainIndex: 1,
        item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
        ordinal: 0,
      },
    ],
    verifiedHead: 1,
  };

  const refreshed = {
    chainIndex: 1,
    item: { affixes: [], baseID: 'base_2', contentVersion: '1', rarityID: 'common' },
    ordinal: 0,
  };

  const page = { items: [refreshed], verifiedHead: 1 };
  const result = mergeRevealedRewards(previous, page);

  expect(result.items).toStrictEqual([refreshed]);
});

test('it carries the higher verifiedHead of the two pages', () => {
  const result = mergeRevealedRewards(
    { items: [], verifiedHead: 5 },
    { items: [], verifiedHead: 3 },
  );

  expect(result.verifiedHead).toBe(5);
});

test('it starts fresh when there is no previous page', () => {
  const page = {
    items: [
      {
        chainIndex: 1,
        item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
        ordinal: 0,
      },
    ],
    verifiedHead: 1,
  };

  const result = mergeRevealedRewards(undefined, page);

  expect(result).toStrictEqual(page);
});
