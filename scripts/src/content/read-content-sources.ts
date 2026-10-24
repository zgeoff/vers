import path from 'node:path';
import { Glob } from 'bun';
import type { ContentSource } from './types';

const CONTENT_SOURCE_DIRS = ['libs/game/item-gen/src', 'libs/game/worldmap-content/src'];
const TEST_ONLY_PATH = /\.test\.ts$|(?:^|\/)(?:mocks|test-utils)\//u;

export async function readContentSources(repoRoot: string): Promise<ReadonlyArray<ContentSource>> {
  const sources: Array<ContentSource> = [];

  for (const sourceDir of CONTENT_SOURCE_DIRS) {
    for await (const relativePath of new Glob('**/*.ts').scan({
      cwd: path.join(repoRoot, sourceDir),
    })) {
      if (TEST_ONLY_PATH.test(relativePath)) {
        continue;
      }

      const sourcePath = `${sourceDir}/${relativePath}`;

      sources.push({
        path: sourcePath,
        text: await Bun.file(path.join(repoRoot, sourcePath)).text(),
      });
    }
  }

  return sources;
}
