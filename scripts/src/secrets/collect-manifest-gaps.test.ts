import { expect, test } from 'bun:test';
import { collectManifestGaps } from './collect-manifest-gaps';

test('it reports no gap when the manifest lists exactly what the sources read', () => {
  expect(
    collectManifestGaps({ vaults: { ops: { billing: ['api-key'] } } }, [
      {
        path: 'infra/.env.example',
        references: [{ field: 'api-key', item: 'billing', vault: 'ops' }],
      },
    ]),
  ).toStrictEqual({ unlisted: [], unread: [] });
});

test('it reports a read field that the manifest lacks, with the file that reads it', () => {
  expect(
    collectManifestGaps({ vaults: { ops: { billing: ['api-key'] } } }, [
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
  expect(
    collectManifestGaps({ vaults: { ops: { billing: ['api-key'] } } }, [
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
  expect(
    collectManifestGaps({ vaults: { ops: { billing: ['api-key', 'region'] } } }, [
      { path: '.mcp.json', references: [{ field: 'api-key', item: 'billing', vault: 'ops' }] },
    ]),
  ).toStrictEqual({ unlisted: [], unread: [{ field: 'region', item: 'billing', vault: 'ops' }] });
});
