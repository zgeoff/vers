import { expect, test } from 'bun:test';
import { buildDeployArgs } from './build-deploy-args';

test('it deploys the given image with a bounded wait', () => {
  expect(
    buildDeployArgs(
      {
        app: 'vers-app-web',
        configDir: 'apps/web',
        exposure: 'public',
        trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
      },
      'c0ffee1',
      'registry.fly.io/vers-app-web:c0ffee1',
    ),
  ).toStrictEqual([
    'deploy',
    '--config',
    'apps/web/fly.toml',
    '--env',
    'GIT_SHA=c0ffee1',
    '--wait-timeout',
    '3m',
    '--image',
    'registry.fly.io/vers-app-web:c0ffee1',
  ]);
});

test('it leaves the image to fly.toml when none is given', () => {
  expect(
    buildDeployArgs(
      {
        app: 'vers-umami',
        configDir: 'apps/umami',
        exposure: 'public',
        trigger: { kind: 'paths', globs: ['apps/umami/**'] },
      },
      'beadfee',
      null,
    ),
  ).toStrictEqual([
    'deploy',
    '--config',
    'apps/umami/fly.toml',
    '--env',
    'GIT_SHA=beadfee',
    '--wait-timeout',
    '3m',
  ]);
});
