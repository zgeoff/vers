import { expect, test } from 'bun:test';
import { canPurgeArchive } from './can-purge-archive';

test.each([
  ['no head row', undefined, true],
  ['a head row with no stamp', { archivedAt: null }, false],
  ['a stamp at the cutoff', { archivedAt: new Date('2026-04-01T00:00:00.000Z') }, false],
  [
    'a stamp one millisecond before the cutoff',
    { archivedAt: new Date('2026-03-31T23:59:59.999Z') },
    true,
  ],
  ['a stamp after the cutoff', { archivedAt: new Date('2026-04-01T00:00:00.001Z') }, false],
] as const)('it rules an archive with %s purgeable: %p', (_label, head, expected) => {
  expect(canPurgeArchive(head, new Date('2026-04-01T00:00:00.000Z'))).toBe(expected);
});
