import { expect, test } from 'bun:test';
import { parseSecretsManifest } from './parse-secrets-manifest';

test('it parses a manifest of vaults, items and field names', () => {
  expect(
    parseSecretsManifest({ vaults: { ops: { billing: ['api-key', 'region'] } } }).data,
  ).toStrictEqual({ vaults: { ops: { billing: ['api-key', 'region'] } } });
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
