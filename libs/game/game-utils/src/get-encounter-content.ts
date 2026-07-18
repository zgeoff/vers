import invariant from 'tiny-invariant';
import { encounterContentV1 } from './content/encounter-content-v1';
import type { EncounterContent } from './types';

const CONTENT_BY_VERSION: Readonly<Record<string, EncounterContent>> = {
  [encounterContentV1.contentVersion]: encounterContentV1,
};

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
