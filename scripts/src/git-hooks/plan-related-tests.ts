import path from 'node:path';
import type { RelatedTestRun } from './types';

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

    const packageDir = getPackageDirectory(testPath, isFile);
    const tests = testsByPackage.get(packageDir) ?? new Set<string>();

    tests.add(`./${path.posix.relative(packageDir, testPath)}`);
    testsByPackage.set(packageDir, tests);
  }

  return [...testsByPackage].map(([packageDir, tests]) => ({
    packageDir,
    testPaths: [...tests],
  }));
}

const TEST_SUFFIX = /\.test\.tsx?$/u;
const SOURCE_SUFFIX = /\.tsx?$/u;

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

function getPackageDirectory(repoPath: string, isFile: (repoPath: string) => boolean): string {
  let directory = path.posix.dirname(repoPath);

  while (directory !== '.' && !isFile(`${directory}/package.json`)) {
    directory = path.posix.dirname(directory);
  }

  return directory;
}
