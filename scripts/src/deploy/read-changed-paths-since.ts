import { $ } from 'bun';

interface ReadChangedPathsSinceOptions {
  readonly cwd?: string;
}

export async function readChangedPathsSince(
  baseSHA: string,
  options?: ReadChangedPathsSinceOptions,
): Promise<ReadonlyArray<string>> {
  const cwd = options?.cwd ?? process.cwd();

  // rename detection reads both files' contents, which a blobless CI checkout lacks, and a rename
  // listed as its new path alone hides the old path from the staleness globs
  const diff = await $`git diff --name-only --no-renames ${`${baseSHA}..HEAD`}`.cwd(cwd).text();

  return diff.split('\n').filter((path) => path !== '');
}
