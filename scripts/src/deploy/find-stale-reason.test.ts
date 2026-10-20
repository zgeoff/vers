import { expect, test } from 'bun:test';
import { findStaleReason } from './find-stale-reason';
import type { DeployTarget } from './types';

test('it reports stale when the fleet has no trustworthy deployed SHA', () => {
  const target: DeployTarget = {
    app: 'vers-service-user',
    configDir: 'services/user',
    exposure: 'flycast',
    trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
  };

  expect(findStaleReason(target, null)).toInclude('no trustworthy deployed SHA');
});

test('it reports stale when the package is affected since the deployed SHA', () => {
  const target: DeployTarget = {
    app: 'vers-service-user',
    configDir: 'services/user',
    exposure: 'flycast',
    trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
  };

  const changes = { affectedPkgs: ['@vers/service-user'], changedPaths: [] };

  expect(findStaleReason(target, changes)).toInclude('@vers/service-user');
});

test('it reports current when other packages changed but not the target', () => {
  const target: DeployTarget = {
    app: 'vers-service-user',
    configDir: 'services/user',
    exposure: 'flycast',
    trigger: { kind: 'turbo-affected', pkg: '@vers/service-user' },
  };

  const changes = { affectedPkgs: ['@vers/web'], changedPaths: ['apps/web/src/router.tsx'] };

  expect(findStaleReason(target, changes)).toBeNull();
});

test('it reports stale when a watched path changed since the deployed SHA', () => {
  const target: DeployTarget = {
    app: 'vers-bugsink',
    configDir: 'apps/bugsink',
    exposure: 'public',
    trigger: { globs: ['apps/bugsink/**'], kind: 'paths' },
  };

  const changes = { affectedPkgs: [], changedPaths: ['apps/bugsink/fly.toml'] };

  expect(findStaleReason(target, changes)).toInclude('apps/bugsink/fly.toml');
});

test('it reports current when no watched path changed', () => {
  const target: DeployTarget = {
    app: 'vers-bugsink',
    configDir: 'apps/bugsink',
    exposure: 'public',
    trigger: { globs: ['apps/bugsink/**'], kind: 'paths' },
  };

  const changes = { affectedPkgs: [], changedPaths: ['services/user/src/serve.ts'] };

  expect(findStaleReason(target, changes)).toBeNull();
});
