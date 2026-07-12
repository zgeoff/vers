import { expect, test } from 'bun:test';
import path from 'node:path';
import { planEnvWrites } from './plan-env-writes';

test('it resolves each entry targetPath against the repo root', () => {
  const manifest = [
    { itemTitle: 'ITEM_ONE', targetPath: 'apps/web/.env.local', vault: 'vers' as const },
    { itemTitle: 'ITEM_TWO', targetPath: 'libs/data/db/.env.local', vault: 'vers' as const },
  ];

  expect(planEnvWrites(manifest, '/repo')).toStrictEqual([
    {
      filePath: path.join('/repo', 'apps/web/.env.local'),
      itemTitle: 'ITEM_ONE',
      vault: 'vers',
    },
    {
      filePath: path.join('/repo', 'libs/data/db/.env.local'),
      itemTitle: 'ITEM_TWO',
      vault: 'vers',
    },
  ]);
});

test('it returns an empty plan for an empty manifest', () => {
  expect(planEnvWrites([], '/repo')).toStrictEqual([]);
});
