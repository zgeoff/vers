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

  const directory = await mkdtemp(join(tmpdir(), 'vers-lint-plugin-test-'));

  onTestFinished(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  // the root config's env declares Math as a global, which changes how its references resolve
  const config = {
    env: { browser: true, node: true, es2024: true },
    jsPlugins: [pluginPath],
    rules: { 'vers/no-unportable-math': 'error' },
  };

  await writeFile(join(directory, '.oxlintrc.json'), JSON.stringify(config));
  await writeFile(join(directory, 'sample.ts'), source);

  const child = Bun.spawn([oxlintBin, '-c', '.oxlintrc.json', 'sample.ts'], {
    cwd: directory,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text()]);

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

test('it flags a non-integer exponent on the **= operator', async () => {
  const result = await setupTest('let a = 3;\na **= 0.5;\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('no-unportable-math');
});

test('it leaves an integer exponent on the **= operator alone', async () => {
  const result = await setupTest('let a = 3;\na **= 2;\n');

  expect(result.exitCode).toBe(0);
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

test('it flags a banned Math member reached by destructuring', async () => {
  const result = await setupTest('const { exp } = Math;\nconst a = exp(2);\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('Math.exp is banned');
});

test('it flags a banned Math member destructured under a new name or a string key', async () => {
  const source = [
    'const { log: ln } = Math;',
    "const { 'sin': sine } = Math;",
    "const { ['cos']: cosine } = Math;",
    'let tangent;',
    '({ tan: tangent } = Math);',
    'function f({ atan } = Math) { return atan; }',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/no-unportable-math/gu)).toHaveLength(5);
});

test('it flags Math.pow stored in a variable', async () => {
  const result = await setupTest('const power = Math.pow;\nconst a = power(2, 0.5);\n');

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('only as a direct call');
});

test('it flags Math.pow reached other than by a direct call', async () => {
  const source = [
    'const { pow } = Math;',
    'const a = Math.pow.call(undefined, 2, 0.5);',
    'const b = [2].map(Math.pow);',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/only as a direct call/gu)).toHaveLength(3);
});

test('it flags Math stored, passed, or spread out as a value', async () => {
  const source = [
    'const M = Math;',
    'const a = (Math as { exp: (x: number) => number }).exp(2);',
    'const { ...rest } = Math;',
    'useMath(Math);',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/only as Math\.member/gu)).toHaveLength(4);
});

test('it flags a Math member chosen at runtime', async () => {
  const result = await setupTest("const key = 'exp';\nconst a = Math[key](2);\n");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('chosen at runtime');
});

test('it flags a banned Math member reached through globalThis', async () => {
  const source = ['const a = globalThis.Math.exp(2);', 'const b = globalThis.Math.pow;', ''].join(
    '\n',
  );

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/no-unportable-math/gu)).toHaveLength(2);
});

test('it flags a banned Math member reached through every global object', async () => {
  const source = [
    'const a = window.Math.exp(2);',
    'const b = self.Math.log(2);',
    'const c = global.Math.pow(2, 0.5);',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/no-unportable-math/gu)).toHaveLength(3);
});

test('it flags Math destructured from a global object', async () => {
  const source = ['const { Math: M } = globalThis;', 'const { Math: { exp } } = window;', ''].join(
    '\n',
  );

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toInclude('only as Math.member');
  expect(result.stdout).toInclude('Math.exp is banned');
});

test('it flags a global object stored, spread out, or keyed at runtime', async () => {
  const source = [
    'const g = globalThis;',
    'const { ...rest } = self;',
    "const key = 'Math';",
    'const a = global[key];',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/with the member named directly/gu)).toHaveLength(3);
});

test('it leaves Math used as a type alone', async () => {
  const source = [
    'type MathShape = Math;',
    'let value: Math | undefined;',
    'const { crypto } = globalThis;',
    'globalThis.someRunner = undefined;',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(0);
});

test('it leaves allowed Math members alone however they are reached', async () => {
  const source = [
    'const { floor, max: maximum } = Math;',
    'const a = floor(1.5) + maximum(1, 2);',
    'const b = Math.pow(2, 3);',
    'const c = globalThis.Math.sqrt(4);',
    'type MathLike = typeof Math;',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(0);
});

test('it flags a banned Math member when a type named Math is declared', async () => {
  const source = [
    'interface Math { extra: number }',
    'type globalThis = unknown;',
    'const a = Math.exp(2);',
    'const b = globalThis.Math.log(2);',
    '',
  ].join('\n');

  const result = await setupTest(source);

  expect(result.exitCode).toBe(1);
  expect(result.stdout.match(/no-unportable-math/gu)).toHaveLength(2);
});

test('it leaves a local binding named Math alone', async () => {
  const result = await setupTest(
    'function f(Math: { exp: (x: number) => number }) { return Math.exp(2); }\n',
  );

  expect(result.exitCode).toBe(0);
});
