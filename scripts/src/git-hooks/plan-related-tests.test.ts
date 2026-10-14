import { expect, test } from 'bun:test';
import { planRelatedTests } from './plan-related-tests';

test('it runs a changed test file in its own package', () => {
  const files = new Set(['libs/core/utils/package.json', 'libs/core/utils/src/a.test.ts']);

  expect(
    planRelatedTests(['libs/core/utils/src/a.test.ts'], (repoPath) => files.has(repoPath)),
  ).toStrictEqual([{ packageDir: 'libs/core/utils', testPaths: ['./src/a.test.ts'] }]);
});

test('it runs the sibling test of a changed source file', () => {
  const files = new Set(['apps/web/package.json', 'apps/web/src/lib/a.test.tsx']);

  expect(
    planRelatedTests(['apps/web/src/lib/a.tsx'], (repoPath) => files.has(repoPath)),
  ).toStrictEqual([{ packageDir: 'apps/web', testPaths: ['./src/lib/a.test.tsx'] }]);
});

test('it groups the tests of one package into one run, without duplicates', () => {
  const files = new Set([
    'services/user/package.json',
    'services/user/src/a.test.ts',
    'services/user/src/b/c.test.ts',
    'libs/core/utils/package.json',
    'libs/core/utils/src/d.test.ts',
  ]);

  expect(
    planRelatedTests(
      [
        'services/user/src/a.ts',
        'services/user/src/a.test.ts',
        'libs/core/utils/src/d.ts',
        'services/user/src/b/c.ts',
      ],
      (repoPath) => files.has(repoPath),
    ),
  ).toStrictEqual([
    { packageDir: 'services/user', testPaths: ['./src/a.test.ts', './src/b/c.test.ts'] },
    { packageDir: 'libs/core/utils', testPaths: ['./src/d.test.ts'] },
  ]);
});

test('it runs a test outside every workspace package from the repo root', () => {
  const files = new Set(['tools/a.test.ts']);

  expect(planRelatedTests(['tools/a.ts'], (repoPath) => files.has(repoPath))).toStrictEqual([
    { packageDir: '.', testPaths: ['./tools/a.test.ts'] },
  ]);
});

test('it skips a source file with no sibling test, a declaration file, and a non-TypeScript file', () => {
  const files = new Set([
    'scripts/package.json',
    'scripts/src/types.test.ts',
    'scripts/src/b.test.ts',
  ]);

  expect(
    planRelatedTests(
      ['scripts/src/a.ts', 'scripts/src/types.d.ts', 'scripts/src/b.md', 'lefthook.yml'],
      (repoPath) => files.has(repoPath),
    ),
  ).toStrictEqual([]);
});

test('it skips a changed test file that no longer exists', () => {
  const files = new Set(['scripts/package.json']);

  expect(
    planRelatedTests(['scripts/src/gone.test.ts'], (repoPath) => files.has(repoPath)),
  ).toStrictEqual([]);
});
