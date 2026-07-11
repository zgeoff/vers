import { expect, test } from 'bun:test';
import { checkTarget } from './check-target';
import type { DeployTarget } from './types';

const target: DeployTarget = {
  app: 'vers-service-user',
  configDir: 'services/user',
  trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
};

test('it flags an app with no machines', () => {
  const state = { deployedSHA: null, machines: [] };

  expect(checkTarget(target, state, null)).toStrictEqual(['no machines exist']);
});

test('it passes a current app with a suspended machine', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'suspended' }],
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(target, state, changes)).toBeEmpty();
});

test('it flags an app below its warm-machine floor', () => {
  const warmTarget: DeployTarget = { ...target, minStartedMachines: 1 };

  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'suspended' }],
  };

  const changes = { affectedPkgs: [], changedPaths: [] };

  expect(checkTarget(warmTarget, state, changes)).toStrictEqual([
    '0 machines started, expected at least 1',
  ]);
});

test('it flags a stale app whose package changed since the deployed SHA', () => {
  const state = {
    deployedSHA: 'abc123',
    machines: [{ gitSHA: 'abc123', id: 'm1', state: 'started' }],
  };

  const changes = { affectedPkgs: ['@vers/service-user'], changedPaths: [] };

  expect(checkTarget(target, state, changes)).toStrictEqual([
    expect.toInclude('@vers/service-user'),
  ]);
});
