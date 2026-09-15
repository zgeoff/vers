import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface LintResult {
  exitCode: number;
  stdout: string;
}

async function setupTest(source: string): Promise<LintResult> {
  const oxlintBin = join(import.meta.dir, '..', '..', '..', 'node_modules', '.bin', 'oxlint');
  const pluginPath = join(import.meta.dir, 'plugin.js');

  const dir = await mkdtemp(join(tmpdir(), 'vers-lint-plugin-test-'));

  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const config = { jsPlugins: [pluginPath], rules: { 'vers/no-unportable-math': 'error' } };

  await writeFile(join(dir, '.oxlintrc.json'), JSON.stringify(config));
  await writeFile(join(dir, 'sample.ts'), source);

  const proc = Bun.spawn([oxlintBin, '-c', '.oxlintrc.json', 'sample.ts'], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);

  return { exitCode, stdout };
}

test('it flags a banned Math member', async () => {
  const result = await setupTest('const a = Math.exp(2);\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it flags a banned Math member reached by a string key', async () => {
  const result = await setupTest("const a = Math['exp'](2);\n");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it flags a non-integer exponent on Math.pow', async () => {
  const result = await setupTest('const a = Math.pow(2, 0.5);\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it flags a non-integer exponent on Math.pow reached by a string key', async () => {
  const result = await setupTest("const a = Math['pow'](2, 0.5);\n");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it flags a non-integer exponent on the ** operator', async () => {
  const result = await setupTest('const a = 3 ** 0.5;\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it leaves a negative integer exponent alone', async () => {
  const source = ['const a = Math.pow(2, -1);', 'const b = 2 ** -1;', ''].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(0);
});

test('it flags toFixed and both spellings of parseFloat', async () => {
  const source = [
    'const a = (5.5).toFixed(2);',
    "const b = parseFloat('1.5');",
    "const c = Number.parseFloat('1.5');",
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/no-unportable-math/gu)).toHaveLength(3);
});

test('it flags toFixed reached by a string key', async () => {
  const result = await setupTest("const a = (5.5)['toFixed'](2);\n");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it leaves an unrelated parseFloat property alone', async () => {
  const result = await setupTest('const a = someObj.parseFloat(x);\n');

  expect(result.exitCode).toBe(0);
});

test('it leaves the allowed operations alone', async () => {
  const source = [
    'const a = Math.sqrt(4);',
    'const b = Math.floor(1.5);',
    'const c = Math.round(1.5);',
    'const d = Math.min(1, 2);',
    'const e = Math.max(1, 2);',
    'const f = 1 / 2;',
    'const g = (5 - 1) ** 2;',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(0);
});

test('it leaves Math.random alone', async () => {
  const result = await setupTest('const a = Math.random();\n');

  expect(result.exitCode).toBe(0);
});
