import { expect, test } from 'bun:test';
import { parseSecretsManifest } from './parse-secrets-manifest';

test('it parses a manifest of vaults, items and field names', () => {
  expect(
    parseSecretsManifest({ vaults: { ops: { billing: ['api-key', 'region'] } } }).data,
  ).toStrictEqual({ vaults: new Map([['ops', new Map([['billing', ['api-key', 'region']]])]]) });
});

test.each([
  ['__proto__', `{"vaults":{"__proto__":{"__proto__":["__proto__"]}}}`],
  ['constructor', `{"vaults":{"constructor":{"constructor":["constructor"]}}}`],
  ['toString', `{"vaults":{"toString":{"toString":["toString"]}}}`],
])('it keeps %s as a vault, item and field name', (name, document) => {
  const items = new Map([[name, [name]]]);

  expect(parseSecretsManifest(JSON.parse(document)).data).toStrictEqual({
    vaults: new Map([[name, items]]),
  });
});

test('it rejects a manifest that holds values beside the names', () => {
  const result = parseSecretsManifest({
    values: { 'api-key': 'sk-made-up' },
    vaults: { ops: { billing: ['api-key'] } },
  });

  expect(result.error?.issues).toPartiallyContain({ keys: ['values'], path: [] });
});

test('it rejects an item whose fields map to values instead of listing names', () => {
  const result = parseSecretsManifest({
    vaults: { ops: { billing: { 'api-key': 'sk-made-up' } } },
  });

  expect(result.error?.issues).toPartiallyContain({ path: ['vaults', 'ops', 'billing'] });
});

test('it rejects a vault table that is a list', () => {
  const result = parseSecretsManifest({ vaults: [['ops', { billing: ['api-key'] }]] });

  expect(result.error?.issues).toPartiallyContain({ path: ['vaults'] });
});
