import { expect, test } from 'bun:test';
import { buildContentDigest } from './build-content-digest';

test('it reproduces the frozen golden digest for a fixed source set', () => {
  expect(
    buildContentDigest([
      { path: 'libs/game/item-gen/src/index.ts', text: "export const rarity = 'common';\n" },
      { path: 'libs/game/worldmap-content/src/index.ts', text: 'export const pools = 2;\n' },
    ]),
  ).toMatchInlineSnapshot(`"3bd921efae3273d15308117d218b055b4134ea695f3403deefe8fbcc26b7b1f0"`);
});

test('it digests equal source sets equally', () => {
  expect(
    buildContentDigest([{ path: 'libs/game/item-gen/src/index.ts', text: 'export {};\n' }]),
  ).toBe(buildContentDigest([{ path: 'libs/game/item-gen/src/index.ts', text: 'export {};\n' }]));
});

test('it digests the same sources equally whatever order they are read in', () => {
  expect(
    buildContentDigest([
      { path: 'libs/game/item-gen/src/a.ts', text: 'export const a = 1;\n' },
      { path: 'libs/game/item-gen/src/b.ts', text: 'export const b = 2;\n' },
    ]),
  ).toBe(
    buildContentDigest([
      { path: 'libs/game/item-gen/src/b.ts', text: 'export const b = 2;\n' },
      { path: 'libs/game/item-gen/src/a.ts', text: 'export const a = 1;\n' },
    ]),
  );
});

test('it changes the digest when one source text changes', () => {
  expect(
    buildContentDigest([
      { path: 'libs/game/item-gen/src/roll.ts', text: 'drawRarity();\ndrawBase();\n' },
    ]),
  ).not.toBe(
    buildContentDigest([
      { path: 'libs/game/item-gen/src/roll.ts', text: 'drawBase();\ndrawRarity();\n' },
    ]),
  );
});

test('it changes the digest when a source moves to another path', () => {
  expect(
    buildContentDigest([{ path: 'libs/game/item-gen/src/a.ts', text: 'export {};\n' }]),
  ).not.toBe(buildContentDigest([{ path: 'libs/game/item-gen/src/b.ts', text: 'export {};\n' }]));
});

test('it keeps a path and its text apart, so moving a boundary between them changes the digest', () => {
  expect(buildContentDigest([{ path: 'src/ab', text: 'c' }])).not.toBe(
    buildContentDigest([{ path: 'src/a', text: 'bc' }]),
  );
});
