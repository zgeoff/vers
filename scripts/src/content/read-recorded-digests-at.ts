import { $ } from 'bun';
import * as z from 'zod';

const DIGESTS_PATH = 'libs/game/content-version/src/content-version-digests.json';
const RecordedDigestsSchema = z.record(z.string(), z.string());

export async function readRecordedDigestsAt(
  ref: string,
  repoRoot: string,
): Promise<Readonly<Record<string, string>>> {
  await $`git rev-parse --verify --quiet ${`${ref}^{commit}`}`.cwd(repoRoot).quiet();

  const recorded = await $`git cat-file -e ${`${ref}:${DIGESTS_PATH}`}`
    .cwd(repoRoot)
    .nothrow()
    .quiet();

  if (recorded.exitCode !== 0) {
    return {};
  }

  const shown = await $`git show ${`${ref}:${DIGESTS_PATH}`}`.cwd(repoRoot).text();

  const parsed: unknown = JSON.parse(shown);

  return RecordedDigestsSchema.parse(parsed);
}
