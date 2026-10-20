import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PINNED_BUN_VERSION } from './load-engine-hash';

function setupTest() {
  const loadEngineHashPath = path.resolve(import.meta.dirname, 'load-engine-hash.ts');

  // hashes in a fresh bun process: Bun.build misreads store files of packages the invoking process
  // has already imported, and the test preload imports pg and faker before any test runs
  const loadEngineHashInSubprocess = async (entrypoint?: string): Promise<string> => {
    const script = `
      import { loadEngineHash } from ${JSON.stringify(loadEngineHashPath)};
      process.stdout.write(await loadEngineHash(${entrypoint === undefined ? '' : JSON.stringify(entrypoint)}));
    `;

    const child = Bun.spawn(['bun', '-e', script], { stderr: 'pipe', stdout: 'pipe' });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    expect(stderr).toBeEmpty();
    expect(exitCode).toBe(0);

    return stdout;
  };

  return { loadEngineHashInSubprocess };
}

test('it is pinned to the bun version this process is running', () => {
  expect(PINNED_BUN_VERSION).toBe(Bun.version);
});

test('it produces the same hash across two consecutive builds', async () => {
  const ctx = setupTest();

  const first = await ctx.loadEngineHashInSubprocess();
  const second = await ctx.loadEngineHashInSubprocess();

  expect(first).toBe(second);
});

test('it excludes test utilities and faker from the bundle', async () => {
  const replayEntrypoint = path.resolve(
    import.meta.dirname,
    '../../../libs/game/idle-core/src/replay.ts',
  );

  const script = `
    const result = await Bun.build({
      entrypoints: [${JSON.stringify(replayEntrypoint)}],
      minify: false,
      sourcemap: 'none',
      target: 'bun',
    });
    const texts = await Promise.all(result.outputs.map((output) => output.text()));
    process.stdout.write(texts.join('\\n'));
  `;

  const child = Bun.spawn(['bun', '-e', script], { stderr: 'pipe', stdout: 'pipe' });

  const [bundle, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  expect(stderr).toBeEmpty();
  expect(exitCode).toBe(0);
  expect(bundle).not.toBeEmpty();
  expect(bundle).not.toInclude('test-utils/');
  expect(bundle).not.toInclude('@faker-js/faker');
});

test('it changes the hash when the engine source changes', async () => {
  const ctx = setupTest();
  const idleCoreDirectory = path.resolve(import.meta.dirname, '../../../libs/game/idle-core');

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'idle-core-hash-'));

  onTestFinished(async () => {
    await fs.rm(tmpRoot, { force: true, recursive: true });
  });

  await fs.cp(path.join(idleCoreDirectory, 'src'), path.join(tmpRoot, 'src'), {
    recursive: true,
  });

  await fs.symlink(
    path.join(idleCoreDirectory, 'node_modules'),
    path.join(tmpRoot, 'node_modules'),
    'dir',
  );

  const copiedEntrypoint = path.join(tmpRoot, 'src', 'replay.ts');

  const before = await ctx.loadEngineHashInSubprocess(copiedEntrypoint);

  const constantsPath = path.join(path.dirname(copiedEntrypoint), 'progression/constants.ts');

  const constantsSource = await fs.readFile(constantsPath, 'utf8');

  await fs.writeFile(
    constantsPath,
    constantsSource.replace('COMPLETION_BASE_XP = 25', 'COMPLETION_BASE_XP = 26'),
  );

  const after = await ctx.loadEngineHashInSubprocess(copiedEntrypoint);

  expect(before).not.toBe(after);
});
