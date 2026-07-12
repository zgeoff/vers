import { expect, test } from 'bun:test';
import { pickOrphanedDevDBs } from './pick-orphaned-dev-dbs';

test('it drops databases whose branch no longer exists locally', () => {
  const orphans = pickOrphanedDevDBs({
    branches: ['main'],
    dbNames: ['dev_devbox_main', 'dev_devbox_feat_deleted'],
    machine: 'devbox',
  });

  expect(orphans).toStrictEqual(['dev_devbox_feat_deleted']);
});

test('it keeps every database with a matching local branch', () => {
  const orphans = pickOrphanedDevDBs({
    branches: ['main', 'feat/476-pg-mcp'],
    dbNames: ['dev_devbox_main', 'dev_devbox_feat_476_pg_mcp'],
    machine: 'devbox',
  });

  expect(orphans).toBeEmpty();
});

test('it never touches other machines databases or dev_base', () => {
  const orphans = pickOrphanedDevDBs({
    branches: ['main'],
    dbNames: ['dev_base', 'dev_otherbox_feat_gone', 'dev_devbox_feat_gone', 'vers'],
    machine: 'devbox',
  });

  expect(orphans).toStrictEqual(['dev_devbox_feat_gone']);
});

test('it matches the machine after sanitization', () => {
  const orphans = pickOrphanedDevDBs({
    branches: [],
    dbNames: ['dev_dev_box_local_feat_gone'],
    machine: 'Dev-Box.local',
  });

  expect(orphans).toStrictEqual(['dev_dev_box_local_feat_gone']);
});
