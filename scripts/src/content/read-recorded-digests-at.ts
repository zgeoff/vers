import { execa } from 'execa';
import * as z from 'zod';

const DIGESTS_PATH = 'libs/game/content-version/src/content-version-digests.json';
const RecordedDigestsSchema = z.record(z.string(), z.string());

export async function readRecordedDigestsAt(
  ref: string,
  repoRoot: string,
): Promise<Readonly<Record<string, string>>> {
  await execa('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: repoRoot });

  const recorded = await execa('git', ['cat-file', '-e', `${ref}:${DIGESTS_PATH}`], {
    cwd: repoRoot,
    reject: false,
  });

  if (recorded.exitCode !== 0) {
    return {};
  }

  const shown = await execa('git', ['show', `${ref}:${DIGESTS_PATH}`], { cwd: repoRoot });

  const parsed: unknown = JSON.parse(shown.stdout);

  return RecordedDigestsSchema.parse(parsed);
}
