import { expect, test } from 'bun:test';
import { readStartStamps } from './read-start-stamps';
import { writePendingStartIntent } from './write-pending-start-intent';
import { writeStartStamps } from './write-start-stamps';

test('it reads nothing when no stamps are cached', async () => {
  const stamps = await readStartStamps();

  expect(stamps).toBeUndefined();
});

test('it reads the cached stamps without picking up other preference records', async () => {
  await writePendingStartIntent({
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    scopeID: '2_0',
    scopeType: 'mission',
  });

  await writeStartStamps({ keyVersion: 4, secretRef: 'worldmap', secretVersion: 2 });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 4, secretRef: 'worldmap', secretVersion: 2 });
});
