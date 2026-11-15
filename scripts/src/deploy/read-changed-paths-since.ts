import { $ } from 'bun';

interface ReadChangedPathsSinceOptions {
  readonly cwd?: string;

  // the commit the diff ends at; HEAD when unset
  readonly head?: string;
}

export async function readChangedPathsSince(
  baseSHA: string,
  options?: ReadChangedPathsSinceOptions,
): Promise<ReadonlyArray<string>> {
  const cwd = options?.cwd ?? process.cwd();
  const head = options?.head ?? 'HEAD';

  // rename detection reads both files' contents, which a blobless CI checkout lacks, and a rename
  // listed as its new path alone hides the old path from the staleness globs
  const diff = await $`git diff --name-only --no-renames ${`${baseSHA}..${head}`}`.cwd(cwd).text();

  return diff.split('\n').filter((path) => path !== '');
}
