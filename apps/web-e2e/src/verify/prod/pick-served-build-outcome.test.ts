import { expect, test } from 'bun:test';
import type { DeployTarget } from '@vers/scripts';
import { pickServedBuildOutcome } from './pick-served-build-outcome';

test('it passes a served commit that nothing the web app builds from has changed since', () => {
  const web: DeployTarget = {
    app: 'vers-app-web',
    configDir: 'apps/web',
    exposure: 'public',
    trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
  };

  const outcome = pickServedBuildOutcome(web, {
    served: '4f0c2e9a7b1d',
    main: 'beadfee1c0de',
    changes: { affectedPkgs: ['@vers/service-user'], changedPaths: ['services/user/src/a.ts'] },
  });

  expect(outcome).toStrictEqual({ kind: 'current', served: '4f0c2e9a7b1d' });
});

test('it fails a served commit that main has changed the web app since', () => {
  const web: DeployTarget = {
    app: 'vers-app-web',
    configDir: 'apps/web',
    exposure: 'public',
    trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
  };

  const outcome = pickServedBuildOutcome(web, {
    served: '4f0c2e9a7b1d',
    main: 'beadfee1c0de',
    changes: { affectedPkgs: ['@vers/web'], changedPaths: ['apps/web/src/a.ts'] },
  });

  expect(outcome).toStrictEqual({
    kind: 'failed',
    message: expect.stringContaining('@vers/web is affected'),
  });
});

test('it fails a served commit that this clone does not hold', () => {
  const web: DeployTarget = {
    app: 'vers-app-web',
    configDir: 'apps/web',
    exposure: 'public',
    trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
  };

  const outcome = pickServedBuildOutcome(web, {
    served: '4f0c2e9a7b1d',
    main: 'beadfee1c0de',
    changes: null,
  });

  expect(outcome).toStrictEqual({
    kind: 'failed',
    message: expect.stringContaining('no trustworthy deployed SHA'),
  });
});

test('it fails a web app that serves no commit', () => {
  const web: DeployTarget = {
    app: 'vers-app-web',
    configDir: 'apps/web',
    exposure: 'public',
    trigger: { kind: 'turbo-affected', pkg: '@vers/web' },
  };

  const outcome = pickServedBuildOutcome(web, {
    served: null,
    main: 'beadfee1c0de',
    changes: null,
  });

  expect(outcome).toStrictEqual({
    kind: 'failed',
    message: 'The web app serves no commit on /health.',
  });
});
