import { expect, test } from 'bun:test';
import { pickQARequestRefusal } from './pick-qa-request-refusal';

test('it admits the QA token holder calling createQAAccount', () => {
  expect(
    pickQARequestRefusal({
      authorization: 'Bearer placeholder-qa-token-placeholder',
      configuredToken: 'placeholder-qa-token-placeholder',
      procedurePath: ['createQAAccount'],
    }),
  ).toBeNull();
});

test('it reports the endpoint as disabled when no token is configured, whatever the caller sends', () => {
  expect(
    pickQARequestRefusal({
      authorization: 'Bearer placeholder-qa-token-placeholder',
      configuredToken: undefined,
      procedurePath: ['createQAAccount'],
    }),
  ).toBe('disabled');
});

test.each([
  { authorization: null },
  { authorization: 'placeholder-qa-token-placeholder' },
  { authorization: 'Bearer placeholder-qa-token-placeholde' },
  { authorization: 'Bearer placeholder-qa-token-placeholder0' },
  { authorization: 'Basic placeholder-qa-token-placeholder' },
])('it refuses the authorization header $authorization', (row) => {
  expect(
    pickQARequestRefusal({
      authorization: row.authorization,
      configuredToken: 'placeholder-qa-token-placeholder',
      procedurePath: ['createQAAccount'],
    }),
  ).toBe('unauthorized');
});

test('it refuses a caller without the token before it looks at the procedure', () => {
  expect(
    pickQARequestRefusal({
      authorization: null,
      configuredToken: 'placeholder-qa-token-placeholder',
      procedurePath: ['getCurrentActivity'],
    }),
  ).toBe('unauthorized');
});

test.each([
  { procedurePath: ['getCurrentActivity'] },
  { procedurePath: ['stopActivity'] },
  { procedurePath: [] },
  { procedurePath: ['createQAAccount', 'extra'] },
])('it refuses the QA token holder calling $procedurePath', (row) => {
  expect(
    pickQARequestRefusal({
      authorization: 'Bearer placeholder-qa-token-placeholder',
      configuredToken: 'placeholder-qa-token-placeholder',
      procedurePath: row.procedurePath,
    }),
  ).toBe('unknown-procedure');
});
