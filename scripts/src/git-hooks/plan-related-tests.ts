import path from 'node:path';
import type { RelatedTestRun } from './types';

const TEST_SUFFIX = /\.test\.tsx?$/;
const SOURCE_SUFFIX = /\.tsx?$/;

export function planRelatedTests(
  changedPaths: ReadonlyArray<string>,
  isFile: (repoPath: string) => boolean,
): Array<RelatedTestRun> {
  const testsByPackage = new Map<string, Set<string>>();

  for (const changedPath of changedPaths) {
    const testPath = findRelatedTest(changedPath, isFile);

    if (testPath === undefined) {
      continue;
    }

    const packageDir = findPackageDir(testPath, isFile);
    const tests = testsByPackage.get(packageDir) ?? new Set<string>();

    tests.add(`./${path.posix.relative(packageDir, testPath)}`);
    testsByPackage.set(packageDir, tests);
  }

  return [...testsByPackage].map(([packageDir, tests]) => ({
    packageDir,
    testPaths: [...tests],
  }));
}

function findRelatedTest(
  changedPath: string,
  isFile: (repoPath: string) => boolean,
): string | undefined {
  if (TEST_SUFFIX.test(changedPath)) {
    return isFile(changedPath) ? changedPath : undefined;
  }

  if (!SOURCE_SUFFIX.test(changedPath) || changedPath.endsWith('.d.ts')) {
    return undefined;
  }

  const stem = changedPath.replace(SOURCE_SUFFIX, '');

  return [`${stem}.test.ts`, `${stem}.test.tsx`].find((candidate) => isFile(candidate));
}

function findPackageDir(repoPath: string, isFile: (repoPath: string) => boolean): string {
  let dir = path.posix.dirname(repoPath);

  while (dir !== '.' && !isFile(`${dir}/package.json`)) {
    dir = path.posix.dirname(dir);
  }

  return dir;
}
