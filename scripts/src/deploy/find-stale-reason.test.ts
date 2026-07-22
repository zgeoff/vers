import { expect, test } from 'bun:test';
import { findStaleReason } from './find-stale-reason';
import type { DeployTarget } from './types';

const affectedTarget: DeployTarget = {
  app: 'vers-service-user',
  configDir: 'services/user',
  exposure: 'flycast',
  trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
};

const pathsTarget: DeployTarget = {
  app: 'vers-bugsink',
  configDir: 'apps/bugsink',
  exposure: 'public',
  trigger: { globs: ['apps/bugsink/**'], kind: 'paths' },
};

test('it reports stale when the fleet has no trustworthy deployed SHA', () => {
  expect(findStaleReason(affectedTarget, null)).toInclude('no trustworthy deployed SHA');
});

test('it reports stale when the package is affected since the deployed SHA', () => {
  const changes = { affectedPkgs: ['@vers/service-user'], changedPaths: [] };

  expect(findStaleReason(affectedTarget, changes)).toInclude('@vers/service-user');
});

test('it reports current when other packages changed but not the target', () => {
  const changes = { affectedPkgs: ['@vers/web'], changedPaths: ['apps/web/src/router.tsx'] };

  expect(findStaleReason(affectedTarget, changes)).toBeNull();
});

test('it reports stale when a watched path changed since the deployed SHA', () => {
  const changes = { affectedPkgs: [], changedPaths: ['apps/bugsink/fly.toml'] };

  expect(findStaleReason(pathsTarget, changes)).toInclude('apps/bugsink/fly.toml');
});

test('it reports current when no watched path changed', () => {
  const changes = { affectedPkgs: [], changedPaths: ['services/user/src/serve.ts'] };

  expect(findStaleReason(pathsTarget, changes)).toBeNull();
});
