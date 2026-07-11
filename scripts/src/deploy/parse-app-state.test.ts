import { expect, test } from 'bun:test';
import { parseAppState } from './parse-app-state';

test('it reads the deployed SHA the whole fleet agrees on', () => {
  const json = [
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm1', state: 'started' },
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm2', state: 'suspended' },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [
      { gitSHA: 'abc123', id: 'm1', state: 'started' },
      { gitSHA: 'abc123', id: 'm2', state: 'suspended' },
    ],
  });
});

test('it treats a fleet with mixed SHAs as having no deployed SHA', () => {
  const json = [
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm1', state: 'started' },
    { config: { env: { GIT_SHA: 'def456' } }, id: 'm2', state: 'started' },
  ];

  expect(parseAppState(json).deployedSHA).toBeNull();
});

test('it treats machines without a stamped SHA as having no deployed SHA', () => {
  const json = [{ config: { env: {} }, id: 'm1', state: 'started' }];

  expect(parseAppState(json).deployedSHA).toBeNull();
});

test('it ignores machines outside the app process group', () => {
  const json = [
    { config: { env: { GIT_SHA: 'abc123' } }, id: 'm1', state: 'started' },
    {
      config: { env: { GIT_SHA: 'def456' }, metadata: { fly_process_group: 'release_command' } },
      id: 'm2',
      state: 'destroyed',
    },
  ];

  expect(parseAppState(json)).toStrictEqual({
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
  });
});

test('it parses an empty fleet', () => {
  expect(parseAppState([])).toStrictEqual({ deployedSHA: null, machines: [] });
});
