import { expect, test } from 'bun:test';
import { parseEnvExample } from './parse-env-example';

test('it reads each variable with the comment block above it', () => {
  const rows = parseEnvExample(
    [
      '# 32+ characters — session sealing rejects shorter',
      'SESSION_SECRET=',
      '',
      'NODE_ENV="e2e"',
    ].join('\n'),
  );

  expect(rows).toStrictEqual([
    { description: '', key: 'NODE_ENV', required: true },
    {
      description: '32+ characters — session sealing rejects shorter',
      key: 'SESSION_SECRET',
      required: true,
    },
  ]);
});

test('it joins a multi-line comment into one description', () => {
  const rows = parseEnvExample(
    ['# any valid key — never verified.', '# generate with: openssl', 'KEY_MATERIAL=x'].join('\n'),
  );

  expect(rows).toStrictEqual([
    {
      description: 'any valid key — never verified. generate with: openssl',
      key: 'KEY_MATERIAL',
      required: true,
    },
  ]);
});

test('it keeps a file-leading banner off the first variable', () => {
  const rows = parseEnvExample(
    [
      '# every value is an op:// reference',
      '',
      '# zone access',
      'CLOUDFLARE_API_TOKEN=op://x',
    ].join('\n'),
  );

  expect(rows).toStrictEqual([
    { description: 'zone access', key: 'CLOUDFLARE_API_TOKEN', required: true },
  ]);
});
