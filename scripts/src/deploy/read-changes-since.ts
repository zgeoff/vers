import { fileURLToPath } from 'node:url';
import { $ } from 'bun';
import { z } from 'zod';
import { makeContextExcluder } from './make-context-excluder';
import { parseDockerignore } from './parse-dockerignore';
import { readChangedPathsSince } from './read-changed-paths-since';
import { readCommitRelation } from './read-commit-relation';
import type { ChangeSet } from './types';

const turboDryRunSchema = z.object({
  packages: z.array(z.string()),
});

const TURBO_BIN = fileURLToPath(new URL('../../../node_modules/.bin/turbo', import.meta.url));

export async function readChangesSince(baseSHA: string): Promise<ChangeSet | null> {
  const relation = await readCommitRelation(baseSHA);

  if (relation === 'missing') {
    return null;
  }

  if (relation === 'same' || relation === 'descendant') {
    return { affectedPkgs: [], changedPaths: [] };
  }

  const [allChangedPaths, isExcluded] = await Promise.all([
    readChangedPathsSince(baseSHA),
    readContextExcluder(),
  ]);

  const changedPaths = allChangedPaths.filter((path) => !isExcluded(path));
  const dryRunArgs = ['run', 'build', '--affected', '--dry=json'];

  const dryRun = await $`${TURBO_BIN} ${dryRunArgs}`
    .env({ ...process.env, TURBO_SCM_BASE: baseSHA })
    .text();

  const affectedPkgs = turboDryRunSchema.parse(JSON.parse(dryRun)).packages;

  return { affectedPkgs, changedPaths };
}

async function readContextExcluder(): Promise<(path: string) => boolean> {
  const file = Bun.file('.dockerignore');

  const exists = await file.exists();

  const text = exists ? await file.text() : '';

  return makeContextExcluder(parseDockerignore(text));
}
