import { expect, test } from 'bun:test';
import { pickGateStep } from './pick-gate-step';

test('it gates a pull request on its base branch and body', () => {
  const event = {
    pull_request: {
      body: 'the report',
      base: { ref: 'main' },
      head: { ref: 'add-quarry-node' },
      user: { type: 'User', login: 'quarry-keeper' },
    },
  };

  expect(pickGateStep(event)).toStrictEqual({ kind: 'gate', baseRef: 'main', body: 'the report' });
});

test('it gates a pull request with no body on an empty one', () => {
  const event = {
    pull_request: {
      body: null,
      base: { ref: 'main' },
      head: { ref: 'add-quarry-node' },
      user: { type: 'User', login: 'quarry-keeper' },
    },
  };

  expect(pickGateStep(event)).toStrictEqual({ kind: 'gate', baseRef: 'main', body: '' });
});

test('it skips the release pull request a bot opens', () => {
  const event = {
    pull_request: {
      body: 'release notes',
      base: { ref: 'main' },
      head: { ref: 'release-please--branches--main' },
      user: { type: 'Bot', login: 'zgeoff-release-please[bot]' },
    },
  };

  expect(pickGateStep(event)).toStrictEqual({
    kind: 'skip',
    reason: 'a release pull request carries no verify report',
  });
});

test('it skips a pull request the renovate bot opens from a renovate branch', () => {
  const event = {
    pull_request: {
      body: 'update zod to v5',
      base: { ref: 'main' },
      head: { ref: 'renovate/bump-zod' },
      user: { type: 'Bot', login: 'zgeoff-renovate[bot]' },
    },
  };

  expect(pickGateStep(event)).toStrictEqual({
    kind: 'skip',
    reason: 'a renovate pull request carries no verify report',
  });
});

test.each([
  {
    who: 'a person on the release branch',
    ref: 'release-please--branches--main',
    type: 'User',
    login: 'quarry-keeper',
  },
  {
    who: 'another bot on a renovate branch',
    ref: 'renovate/bump-zod',
    type: 'Bot',
    login: 'other-bot[bot]',
  },
  {
    who: 'a person on a renovate branch',
    ref: 'renovate/bump-zod',
    type: 'User',
    login: 'quarry-keeper',
  },
  {
    who: 'a person whose login is the renovate bot login',
    ref: 'renovate/bump-zod',
    type: 'User',
    login: 'zgeoff-renovate[bot]',
  },
  {
    who: 'the renovate bot on another branch',
    ref: 'bump-zod',
    type: 'Bot',
    login: 'zgeoff-renovate[bot]',
  },
])('it gates $who', (row) => {
  const event = {
    pull_request: {
      body: '',
      base: { ref: 'main' },
      head: { ref: row.ref },
      user: { type: row.type, login: row.login },
    },
  };

  expect(pickGateStep(event)).toStrictEqual({ kind: 'gate', baseRef: 'main', body: '' });
});

test('it refuses an event with no pull request', () => {
  expect(pickGateStep({ ref: 'refs/heads/main' })).toMatchObject({ kind: 'refused' });
});
