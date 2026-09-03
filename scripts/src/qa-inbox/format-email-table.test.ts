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

test('it folds a subject with line breaks or control characters onto one row', () => {
  const table = formatEmailTable([
    {
      createdAt: '2026-09-04T10:00:00Z',
      from: 'anyone@example.com',
      id: 'a1',
      subject: 'Welcome\nb22  forged@example.com  2026-09-04T10:05:00Z  \u001B[31mforged row',
      to: ['qa+1@qa.versidle.com'],
    },
  ]);

  expect(table).toBe(
    'a1  qa+1@qa.versidle.com  2026-09-04T10:00:00Z  Welcome b22  forged@example.com  2026-09-04T10:05:00Z  [31mforged row',
  );
});

test('it renders nothing for no emails', () => {
  expect(formatEmailTable([])).toBe('');
});
