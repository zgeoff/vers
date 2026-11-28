import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { collectFeatureScopes, isGlobMatch } from '@wringer/core';
import { z } from 'zod';
import { createVerifyRegistry } from './create-verify-registry';
import { featurePaths, sharedPaths } from './feature-paths';

async function setupTest() {
  const gateSchema = z.object({ match: z.string(), skills: z.array(z.string()) });
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..');
  const rulesPath = join(rootDir, '.claude', 'skill-gate.json');

  const rulesJSON: unknown = await Bun.file(rulesPath).json();

  const rules = z.object({ gates: z.array(gateSchema) }).parse(rulesJSON);

  const registry = createVerifyRegistry({
    chromiumLauncher: 'chromium-launcher',
    devtoolsPort: 9222,
  });

  const scopes = collectFeatureScopes(registry);

  const trackedText = await Bun.$`git ls-files`.cwd(rootDir).text();

  return {
    rules,
    featureNames: registry.features.map((feature) => feature.name),
    trackedPaths: trackedText.trim().split('\n'),
    isIgnored: (path: string) => isGlobMatch(path, registry.ignore),
    collectFlagged: (path: string) =>
      isGlobMatch(path, registry.ignore)
        ? []
        : scopes.filter((scope) => isGlobMatch(path, scope.globs)).map((scope) => scope.name),
  };
}

test('it asks for the verify skill before an edit under each feature path and shared path', async () => {
  const ctx = await setupTest();

  const verifyGlobs = ctx.rules.gates
    .filter((gate) => gate.skills.includes('verify'))
    .map((gate) => new Bun.Glob(gate.match));

  const mapped = [...Object.values(featurePaths).flat(), ...sharedPaths];

  expect(mapped.filter((glob) => !verifyGlobs.some((gate) => gate.match(glob)))).toStrictEqual([]);
});

test.each([
  { path: 'apps/web/src/routes/-home/home-hero.tsx', flagged: ['public-smoke'] },
  { path: 'services/email/src/index.ts', flagged: ['signup'] },
  { path: 'apps/web/src/routes/-onboarding/run-onboarding.ts', flagged: ['signup'] },
  { path: 'apps/web/src/routes/-avatars/run-avatar-select.ts', flagged: ['avatar-roster'] },
  { path: 'apps/web/src/routes/-login/run-login.ts', flagged: ['device-takeover'] },
  { path: 'apps/web/src/routes/-respite/respite-panel.tsx', flagged: ['device-takeover'] },
  {
    path: 'apps/web/src/routes/-avatar-create/run-avatar-create.ts',
    flagged: ['signup', 'avatar-roster'],
  },
  { path: 'services/verification/src/index.ts', flagged: ['signup', 'device-takeover'] },
  {
    path: 'apps/web/src/routes/-explore-node/explore-node-focus.tsx',
    flagged: ['offline-run', 'device-takeover'],
  },
  {
    path: 'apps/web/src/routes/-activity/activity-panel.tsx',
    flagged: ['offline-run', 'device-takeover'],
  },
  { path: 'services/replay/src/index.ts', flagged: ['offline-run', 'device-takeover'] },
  {
    path: 'services/activity/src/index.ts',
    flagged: ['signup', 'avatar-roster', 'offline-run', 'device-takeover'],
  },
  {
    path: 'libs/game/idle-core/src/index.ts',
    flagged: ['signup', 'avatar-roster', 'offline-run', 'device-takeover'],
  },
])('it flags only the features whose journey reaches $path', async (row) => {
  const ctx = await setupTest();

  expect(ctx.collectFlagged(row.path)).toStrictEqual([...row.flagged]);
});

test.each([
  'apps/web/src/router.tsx',
  'apps/web/src/routes/__root.tsx',
  'apps/web/src/routes/api/rpc/$service/$.ts',
  'apps/web/src/lib/rpc/forward-service-request.ts',
  'apps/web/src/routes/-market/market-panel.tsx',
  'services/avatar/src/handlers/read-avatars.ts',
  'libs/service/service-runtime/src/index.ts',
  'libs/data/db/src/index.ts',
  'libs/game/game-rendering/src/index.ts',
  'contracts/activity/src/index.ts',
  'contracts/user/src/index.ts',
  'contracts/session/src/index.ts',
  'apps/web/src/test-utils/verify/verify.ts',
])('it flags every feature for a change to the core file %s', async (path) => {
  const ctx = await setupTest();

  expect(ctx.collectFlagged(path)).toStrictEqual(ctx.featureNames);
});

test('it reaches every service, contract and lib folder from a feature', async () => {
  const ctx = await setupTest();

  const folders = new Set(
    ctx.trackedPaths
      .filter((path) => /^(?<kind>services|contracts|libs)\//u.test(path))
      .map((path) => {
        const depth = path.startsWith('libs/') ? 3 : 2;

        return path.split('/').slice(0, depth).join('/');
      }),
  );

  const unreached = [...folders].filter((folder) => {
    const runPaths = ctx.trackedPaths.filter(
      (path) => path.startsWith(`${folder}/`) && !ctx.isIgnored(path),
    );

    return runPaths.length > 0 && runPaths.every((path) => ctx.collectFlagged(path).length === 0);
  });

  expect(unreached).toStrictEqual([]);
});

test('it maps every tracked file to a feature or the ignore list', async () => {
  const ctx = await setupTest();

  expect(
    ctx.trackedPaths.filter(
      (path) => !ctx.isIgnored(path) && ctx.collectFlagged(path).length === 0,
    ),
  ).toStrictEqual([]);
});
