import { createHash } from 'node:crypto';
import type { ContentSource } from './types';

export function buildContentDigest(sources: ReadonlyArray<ContentSource>): string {
  const sorted = sources.toSorted((left, right) => left.path.localeCompare(right.path));
  const hash = createHash('sha256');

  for (const source of sorted) {
    hash.update(`${source.path}\0${source.text}\0`);
  }

  return hash.digest('hex');
}
