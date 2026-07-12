import { expect, test } from 'bun:test';
import { parseNotesPlain } from './parse-notes-plain';

test('it reads the notesPlain field value out of op item JSON', () => {
  const raw = {
    fields: [
      { label: 'username', value: 'me@example.com' },
      { label: 'notesPlain', value: 'DATABASE_URL="postgres://user:pass@host/db"' },
    ],
  };

  expect(parseNotesPlain(raw, 'my-item')).toBe('DATABASE_URL="postgres://user:pass@host/db"');
});

test('it preserves embedded newlines in the notesPlain value', () => {
  const raw = {
    fields: [
      {
        label: 'notesPlain',
        value: '-----BEGIN PRIVATE KEY-----\nMC4CAQ\n-----END PRIVATE KEY-----',
      },
    ],
  };

  expect(parseNotesPlain(raw, 'my-item')).toInclude('\n');
});

test('it throws when the item carries no notesPlain field', () => {
  const raw = { fields: [{ label: 'username', value: 'me@example.com' }] };

  expect(() => parseNotesPlain(raw, 'my-item')).toThrowWithMessage(
    Error,
    'item "my-item" has no notesPlain field',
  );
});

test('it throws when the JSON does not match the expected op item shape', () => {
  expect(() => parseNotesPlain({ nope: true }, 'my-item')).toThrowWithMessage(
    Error,
    'item "my-item" did not return the expected op item JSON shape',
  );
});
