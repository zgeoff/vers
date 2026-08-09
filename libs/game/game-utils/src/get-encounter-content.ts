import invariant from 'tiny-invariant';
import { CONTENT_BY_VERSION } from './content/content-by-version';
import type { EncounterContent } from './types';

/**
 * Callers resolve versions pinned in an activity's `Started` snapshot and every shipped version
 * stays loadable, so an unknown version here is a bug, not input.
 */
export function getEncounterContent(contentVersion: string): EncounterContent {
  const content = Object.hasOwn(CONTENT_BY_VERSION, contentVersion)
    ? CONTENT_BY_VERSION[contentVersion]
    : undefined;

  invariant(content, `unknown content version: ${contentVersion}`);

  return content;
}
