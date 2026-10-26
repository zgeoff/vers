import { expect, test } from 'bun:test';
import { collectManifestGaps } from './collect-manifest-gaps';

test('it reports no gap when the manifest lists exactly what the sources read', () => {
  const manifest = { vaults: new Map([['ops', new Map([['billing', ['api-key']]])]]) };

  expect(
    collectManifestGaps(manifest, [
      {
        path: 'infra/.env.example',
        references: [{ field: 'api-key', item: 'billing', vault: 'ops' }],
      },
    ]),
  ).toStrictEqual({ unlisted: [], unread: [] });
});

test('it reports a read field that the manifest lacks, with the file that reads it', () => {
  const manifest = { vaults: new Map([['ops', new Map([['billing', ['api-key']]])]]) };

  expect(
    collectManifestGaps(manifest, [
      {
        path: 'infra/.env.example',
        references: [
          { field: 'api-key', item: 'billing', vault: 'ops' },
          { field: 'region', item: 'billing', vault: 'ops' },
        ],
      },
    ]),
  ).toStrictEqual({
    unlisted: [
      { path: 'infra/.env.example', reference: { field: 'region', item: 'billing', vault: 'ops' } },
    ],
    unread: [],
  });
});

test('it reports a read item from a vault that the manifest lacks', () => {
  const manifest = { vaults: new Map([['ops', new Map([['billing', ['api-key']]])]]) };

  expect(
    collectManifestGaps(manifest, [
      {
        path: '.mcp.json',
        references: [
          { field: 'api-key', item: 'billing', vault: 'ops' },
          { field: 'token', item: 'tracker', vault: 'shared' },
        ],
      },
    ]),
  ).toStrictEqual({
    unlisted: [
      { path: '.mcp.json', reference: { field: 'token', item: 'tracker', vault: 'shared' } },
    ],
    unread: [],
  });
});

test('it reports a listed field that no source reads', () => {
  const manifest = { vaults: new Map([['ops', new Map([['billing', ['api-key', 'region']]])]]) };

  expect(
    collectManifestGaps(manifest, [
      { path: '.mcp.json', references: [{ field: 'api-key', item: 'billing', vault: 'ops' }] },
    ]),
  ).toStrictEqual({ unlisted: [], unread: [{ field: 'region', item: 'billing', vault: 'ops' }] });
});

test.each([
  ['constructor as the vault', { field: 'token', item: 'billing', vault: 'constructor' }],
  ['toString as the vault', { field: 'token', item: 'billing', vault: 'toString' }],
  ['__proto__ as the vault', { field: 'token', item: 'billing', vault: '__proto__' }],
  ['constructor as the item', { field: 'token', item: 'constructor', vault: 'ops' }],
  ['toString as the item', { field: 'token', item: 'toString', vault: 'ops' }],
  ['__proto__ as the item', { field: 'token', item: '__proto__', vault: 'ops' }],
  ['constructor as the field', { field: 'constructor', item: 'billing', vault: 'ops' }],
  ['toString as the field', { field: 'toString', item: 'billing', vault: 'ops' }],
  ['__proto__ as the field', { field: '__proto__', item: 'billing', vault: 'ops' }],
])(
  'it reports a read reference with %s as unlisted when the manifest lacks it',
  (_name, reference) => {
    const manifest = { vaults: new Map([['ops', new Map([['billing', ['token']]])]]) };

    expect(
      collectManifestGaps(manifest, [{ path: '.mcp.json', references: [reference] }]),
    ).toStrictEqual({
      unlisted: [{ path: '.mcp.json', reference }],
      unread: [{ field: 'token', item: 'billing', vault: 'ops' }],
    });
  },
);

test.each([
  ['constructor', 'toString', '__proto__'],
  ['toString', '__proto__', 'constructor'],
  ['__proto__', 'constructor', 'toString'],
])(
  'it matches a listed %s vault, %s item and %s field to the reference that reads them',
  (vault, item, field) => {
    const manifest = { vaults: new Map([[vault, new Map([[item, [field]]])]]) };

    expect(
      collectManifestGaps(manifest, [{ path: '.mcp.json', references: [{ field, item, vault }] }]),
    ).toStrictEqual({ unlisted: [], unread: [] });
  },
);
