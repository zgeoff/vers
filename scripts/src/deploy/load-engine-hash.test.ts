import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PINNED_BUN_VERSION } from './load-engine-hash';

const LOAD_ENGINE_HASH_PATH = path.resolve(import.meta.dirname, 'load-engine-hash.ts');

const REPLAY_ENTRYPOINT = path.resolve(
  import.meta.dirname,
  '../../../libs/game/idle-core/src/replay.ts',
);

const IDLE_CORE_DIR = path.resolve(import.meta.dirname, '../../../libs/game/idle-core');

/**
 * Hashes in a fresh bun process: Bun.build misreads store files belonging to
 * packages the invoking process has already imported, and the test preload
 * loads pg and faker before any test runs — so the build must not share a
 * process with this suite.
 */
async function loadEngineHashInSubprocess(entrypoint?: string): Promise<string> {
  const script = `
    import { loadEngineHash } from ${JSON.stringify(LOAD_ENGINE_HASH_PATH)};
    process.stdout.write(await loadEngineHash(${entrypoint === undefined ? '' : JSON.stringify(entrypoint)}));
  `;

  const proc = Bun.spawn(['bun', '-e', script], { stderr: 'pipe', stdout: 'pipe' });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(stderr).toBeEmpty();
  expect(exitCode).toBe(0);

  return stdout;
}

test('it is pinned to the bun version this process is running', () => {
  expect(PINNED_BUN_VERSION).toBe(Bun.version);
});

test('it produces the same hash across two consecutive builds', async () => {
  const first = await loadEngineHashInSubprocess();
  const second = await loadEngineHashInSubprocess();

  expect(first).toBe(second);
});

test('it excludes test utilities and faker from the bundle', async () => {
  const script = `
    const result = await Bun.build({
      entrypoints: [${JSON.stringify(REPLAY_ENTRYPOINT)}],
      minify: false,
      sourcemap: 'none',
      target: 'bun',
    });
    const texts = await Promise.all(result.outputs.map((output) => output.text()));
    process.stdout.write(texts.join('\\n'));
  `;

  const proc = Bun.spawn(['bun', '-e', script], { stderr: 'pipe', stdout: 'pipe' });

  const [bundle, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(stderr).toBeEmpty();
  expect(exitCode).toBe(0);
  expect(bundle).not.toBeEmpty();
  expect(bundle).not.toInclude('test-utils/');
  expect(bundle).not.toInclude('@faker-js/faker');
});

test('it changes the hash when the engine source changes', async () => {
  const copiedEntrypoint = await createEngineSourceTempDir();
  const before = await loadEngineHashInSubprocess(copiedEntrypoint);

  const constantsPath = path.join(path.dirname(copiedEntrypoint), 'progression/constants.ts');

  const constantsSource = await fs.readFile(constantsPath, 'utf8');

  await fs.writeFile(
    constantsPath,
    constantsSource.replace('COMPLETION_BASE_XP = 25', 'COMPLETION_BASE_XP = 26'),
  );

  const after = await loadEngineHashInSubprocess(copiedEntrypoint);

  expect(before).not.toBe(after);
});

/**
 * Copies the real engine source tree into an mkdtemp dir and symlinks in its
 * already-resolved node_modules, so a build from the copy resolves the same
 * package specifiers as the real entrypoint without a workspace install.
 */
async function createEngineSourceTempDir(): Promise<string> {
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
