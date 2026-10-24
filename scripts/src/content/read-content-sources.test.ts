import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readContentSources } from './read-content-sources';

async function setupTest() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'vers-content-sources-test-'));

  onTestFinished(() => rm(repoRoot, { force: true, recursive: true }));

  return { repoRoot };
}

test('it reads the sources of both content packages, keyed by their repo path', async () => {
  const ctx = await setupTest();

  await mkdir(join(ctx.repoRoot, 'libs/game/item-gen/src/draw'), { recursive: true });
  await mkdir(join(ctx.repoRoot, 'libs/game/worldmap-content/src'), { recursive: true });
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/index.ts'), 'export {};\n');
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/draw/roll.ts'), 'drawRarity();\n');
  await writeFile(join(ctx.repoRoot, 'libs/game/worldmap-content/src/derive.ts'), 'derive();\n');

  const sources = await readContentSources(ctx.repoRoot);

  expect(sources).toIncludeSameMembers([
    { path: 'libs/game/item-gen/src/index.ts', text: 'export {};\n' },
    { path: 'libs/game/item-gen/src/draw/roll.ts', text: 'drawRarity();\n' },
    { path: 'libs/game/worldmap-content/src/derive.ts', text: 'derive();\n' },
  ]);
});

test('it skips test files, mocks and test utilities', async () => {
  const ctx = await setupTest();

  await mkdir(join(ctx.repoRoot, 'libs/game/item-gen/src/test-utils'), { recursive: true });
  await mkdir(join(ctx.repoRoot, 'libs/game/worldmap-content/src/mocks'), { recursive: true });
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/roll.ts'), 'drawRarity();\n');
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/roll.test.ts'), 'test();\n');
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/test-utils/build.ts'), 'build();\n');

  await writeFile(
    join(ctx.repoRoot, 'libs/game/worldmap-content/src/mocks/server.ts'),
    'mock();\n',
  );

  const sources = await readContentSources(ctx.repoRoot);

  expect(sources).toStrictEqual([
    { path: 'libs/game/item-gen/src/roll.ts', text: 'drawRarity();\n' },
  ]);
});

test('it reads no source outside the two content packages', async () => {
  const ctx = await setupTest();

  await mkdir(join(ctx.repoRoot, 'libs/game/item-gen/src'), { recursive: true });
  await mkdir(join(ctx.repoRoot, 'libs/game/worldmap-content/src'), { recursive: true });
  await mkdir(join(ctx.repoRoot, 'libs/game/roll-crypto/src'), { recursive: true });
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/roll.ts'), 'drawRarity();\n');
  await writeFile(join(ctx.repoRoot, 'libs/game/roll-crypto/src/stream.ts'), 'stream();\n');

  const sources = await readContentSources(ctx.repoRoot);

  expect(sources).toStrictEqual([
    { path: 'libs/game/item-gen/src/roll.ts', text: 'drawRarity();\n' },
  ]);
});

test('it fails when a content package is missing, rather than digesting the other alone', async () => {
  const ctx = await setupTest();

  await mkdir(join(ctx.repoRoot, 'libs/game/item-gen/src'), { recursive: true });
  await writeFile(join(ctx.repoRoot, 'libs/game/item-gen/src/roll.ts'), 'drawRarity();\n');

  expect(readContentSources(ctx.repoRoot)).rejects.toMatchObject({ code: 'ENOENT' });
});
