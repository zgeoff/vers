import type { EncounterContent } from '../types';
import { encounterContentV1 } from './encounter-content-v1';
import { encounterContentV2 } from './encounter-content-v2';

/**
 * Every shipped content version, keyed by its `contentVersion`. Exported so a sealed-content
 * derivation can enumerate a version's registered pools without duplicating the registry.
 */
export const CONTENT_BY_VERSION: Readonly<Record<string, EncounterContent>> = {
  [encounterContentV1.contentVersion]: encounterContentV1,
  [encounterContentV2.contentVersion]: encounterContentV2,
};
