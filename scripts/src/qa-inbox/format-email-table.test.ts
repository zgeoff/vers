import { expect, test } from 'bun:test';
import { formatEmailTable } from './format-email-table';

test('it aligns one line per email with the subject last', () => {
  const table = formatEmailTable([
    {
      createdAt: '2026-09-04T10:00:00Z',
      from: 'noreply@versidle.com',
      id: 'a1',
      subject: 'Welcome to vers',
      to: ['qa+1@qa.versidle.com'],
    },
    {
      createdAt: '2026-09-04T10:05:00Z',
      from: 'noreply@versidle.com',
      id: 'b22',
      subject: 'Reset your vers password',
      to: ['qa+1@qa.versidle.com', 'qa+2@qa.versidle.com'],
    },
  ]);

  expect(table).toBe(
    [
      'a1   qa+1@qa.versidle.com                        2026-09-04T10:00:00Z  Welcome to vers',
      'b22  qa+1@qa.versidle.com, qa+2@qa.versidle.com  2026-09-04T10:05:00Z  Reset your vers password',
    ].join('\n'),
  );
});

test('it renders nothing for no emails', () => {
  expect(formatEmailTable([])).toBe('');
});
