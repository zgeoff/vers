import { expect, test } from 'bun:test';
import { parseLockfileDependents } from './parse-lockfile-dependents';

test('it lists the declared ranges of each registry package', () => {
  const lockfile = `{
    "lockfileVersion": 1,
    "packages": {
      "pad-tools": ["pad-tools@2.0.0", "", { "dependencies": { "left-pad": "^1.3.0" }, "optionalDependencies": { "fsevents": "~2.3.0" }, "peerDependencies": { "text-kit": ">=4" } }, "sha512-x"],
    },
  }`;

  expect(parseLockfileDependents(lockfile)).toStrictEqual([
    { dependent: 'pad-tools@2.0.0', name: 'left-pad', range: '^1.3.0' },
    { dependent: 'pad-tools@2.0.0', name: 'fsevents', range: '~2.3.0' },
    { dependent: 'pad-tools@2.0.0', name: 'text-kit', range: '>=4' },
  ]);
});

test('it skips a workspace entry and a package with no dependencies', () => {
  const lockfile = `{
    "lockfileVersion": 1,
    "packages": {
      "@acme/app": ["@acme/app@workspace:apps/app"],
      "left-pad": ["left-pad@1.3.1", "", {}, "sha512-y"],
    },
  }`;

  expect(parseLockfileDependents(lockfile)).toStrictEqual([]);
});

test('it rejects a lockfile with no packages', () => {
  expect(() => parseLockfileDependents('{ "lockfileVersion": 1 }')).toThrow();
});
