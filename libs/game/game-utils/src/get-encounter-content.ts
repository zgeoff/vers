import invariant from 'tiny-invariant';
import { encounterContentV1 } from './content/encounter-content-v1';
import { encounterContentV2 } from './content/encounter-content-v2';
import type { EncounterContent } from './types';

/**
 * Every shipped content version, keyed by its `contentVersion`. Exported so a sealed-content
 * derivation can enumerate a version's registered pools without duplicating the registry.
 */
export const CONTENT_BY_VERSION: Readonly<Record<string, EncounterContent>> = {
  [encounterContentV1.contentVersion]: encounterContentV1,
  [encounterContentV2.contentVersion]: encounterContentV2,
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
