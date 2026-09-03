import { expect, test } from 'bun:test';
import { findOpFieldValue } from './find-op-field-value';

test('it reads the first labelled field that holds a value, in label order', () => {
  const value = findOpFieldValue(
    {
      fields: [
        { id: 'a', label: 'api-key', type: 'CONCEALED', value: 're_restricted' },
        { id: 'b', label: 'full-access-api-key', type: 'CONCEALED', value: 're_full' },
      ],
    },
    ['full-access-api-key', 'api-key'],
  );

  expect(value).toBe('re_full');
});

test('it falls back to the next label when the preferred field is absent', () => {
  const value = findOpFieldValue(
    { fields: [{ id: 'a', label: 'api-key', type: 'CONCEALED', value: 're_restricted' }] },
    ['full-access-api-key', 'api-key'],
  );

  expect(value).toBe('re_restricted');
});

test('it treats an empty field as absent', () => {
  const value = findOpFieldValue(
    {
      fields: [
        { id: 'a', label: 'full-access-api-key', type: 'CONCEALED', value: '' },
        { id: 'b', label: 'api-key', type: 'CONCEALED', value: 're_restricted' },
      ],
    },
    ['full-access-api-key', 'api-key'],
  );

  expect(value).toBe('re_restricted');
});

test('it misses when no label matches', () => {
  expect(
    findOpFieldValue({ fields: [{ id: 'a', label: 'username', value: 'ops' }] }, ['api-key']),
  ).toBeNull();
});

test('it misses when the item is not an op item', () => {
  expect(findOpFieldValue('not an item', ['api-key'])).toBeNull();
});
