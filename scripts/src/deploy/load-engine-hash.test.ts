import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PINNED_BUN_VERSION, loadEngineHash } from './load-engine-hash';

const REPLAY_ENTRYPOINT = path.resolve(
  import.meta.dirname,
  '../../../libs/game/idle-core/src/replay.ts',
);

const IDLE_CORE_DIR = path.resolve(import.meta.dirname, '../../../libs/game/idle-core');

test('it is pinned to the bun version this process is running', () => {
  expect(PINNED_BUN_VERSION).toBe(Bun.version);
});

test('it produces the same hash across two consecutive builds', async () => {
  const first = await loadEngineHash();
  const second = await loadEngineHash();

  expect(first).toBe(second);
});

test('it excludes test utilities and faker from the bundle', async () => {
  const result = await Bun.build({
    entrypoints: [REPLAY_ENTRYPOINT],
    minify: false,
    sourcemap: 'none',
    target: 'bun',
  });

  expect(result.success).toBe(true);

  const texts = await Promise.all(result.outputs.map((output) => output.text()));

  const bundle = texts.join('\n');

  expect(bundle).not.toInclude('test-utils/');
  expect(bundle).not.toInclude('@faker-js/faker');
});

/**
 * Copies the real engine source tree into an mkdtemp dir and symlinks in its
 * already-resolved node_modules, so a build from the copy resolves the same
 * package specifiers as the real entrypoint without a workspace install.
 */
async function copyEngineSourceToTempDir(): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'idle-core-hash-'));

  onTestFinished(async () => {
    await fs.rm(tmpRoot, { force: true, recursive: true });
  });

  await fs.cp(path.join(IDLE_CORE_DIR, 'src'), path.join(tmpRoot, 'src'), { recursive: true });

  await fs.symlink(
    path.join(IDLE_CORE_DIR, 'node_modules'),
    path.join(tmpRoot, 'node_modules'),
    'dir',
  );

  return path.join(tmpRoot, 'src', 'replay.ts');
}

test('it changes the hash when the engine source changes', async () => {
  const copiedEntrypoint = await copyEngineSourceToTempDir();
  const before = await loadEngineHash(copiedEntrypoint);

  const constantsPath = path.join(path.dirname(copiedEntrypoint), 'progression/constants.ts');

  const constantsSource = await fs.readFile(constantsPath, 'utf8');

  await fs.writeFile(
    constantsPath,
    constantsSource.replace('COMPLETION_BASE_XP = 25', 'COMPLETION_BASE_XP = 26'),
  );

  const after = await loadEngineHash(copiedEntrypoint);

  expect(before).not.toBe(after);
});
