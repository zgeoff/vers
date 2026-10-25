import { expect, test } from 'bun:test';
import { canPurgeArchive } from './can-purge-archive';

test('it purges the archive of an activity whose head row is gone', () => {
  expect(canPurgeArchive(undefined, new Date('2026-04-01T00:00:00.000Z'))).toBeTrue();
});

test('it purges the archive of an activity stamped before the cutoff', () => {
  expect(
    canPurgeArchive(
      { archivedAt: new Date('2026-01-01T00:00:00.000Z') },
      new Date('2026-04-01T00:00:00.000Z'),
    ),
  ).toBeTrue();
});

test('it keeps the archive of an activity stamped at or after the cutoff', () => {
  expect(
    canPurgeArchive(
      { archivedAt: new Date('2026-04-01T00:00:00.000Z') },
      new Date('2026-04-01T00:00:00.000Z'),
    ),
  ).toBeFalse();
});

test('it keeps the archive of an activity with no stamp', () => {
  expect(canPurgeArchive({ archivedAt: null }, new Date('2026-04-01T00:00:00.000Z'))).toBeFalse();
});
