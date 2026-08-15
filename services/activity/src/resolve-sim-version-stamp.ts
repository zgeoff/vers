import type { DB } from '@vers/db';
import type { SimVersionRow } from '@vers/sim-registry';
import { findCurrentSimVersion, findSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { recordContentIncompatibleRejection } from './metrics/record-content-incompatible-rejection';
import type { SimVersionProblemPayload } from './types';

/**
 * Errors `resolveSimVersionStamp` can throw — a subset of a handler's full error map.
 */
interface SimVersionStampErrors {
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

/**
 * Resolves the engine hash a new activity stamps. An absent `requested` (the transitional path,
 * before clients send a hash) stamps the registry's current version, throwing SIM_VERSION_UNKNOWN
 * on an empty registry. A `requested` hash stamps as-is when its row is `active` and retained;
 * SIM_VERSION_UNKNOWN when no row matches it, SIM_VERSION_EXPIRED when its row is `pruned` or past
 * `retainedUntil`. Either path additionally throws SIM_VERSION_EXPIRED when the resolved row's
 * `maxContentVersion` falls behind `contentVersion` — the engine predates the content this activity
 * would stamp and could never derive or replay it, the stale-browser signal a client answers by
 * reloading rather than resyncing. Every error carries the registry's current hash (or null) so the
 * client knows what to resync onto.
 */
export async function resolveSimVersionStamp(
  db: Kysely<DB>,
  requested: string | undefined,
  contentVersion: string,
  errors: SimVersionStampErrors,
): Promise<string> {
  if (requested === undefined) {
    const current = await findCurrentSimVersion(db);

    if (current === undefined) {
      throw errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion: null } });
    }

    if (!isContentVersionSupported(current, contentVersion)) {
      recordContentIncompatibleRejection('fallback');
      throw errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: current.engineHash } });
    }

    return current.engineHash;
  }

  const version = await findSimVersion(db, requested);

  if (version !== undefined && version.status === 'active' && version.retainedUntil > new Date()) {
    if (!isContentVersionSupported(version, contentVersion)) {
      recordContentIncompatibleRejection('requested');

      const current = await findCurrentSimVersion(db);

      throw errors.SIM_VERSION_EXPIRED({
        data: { currentSimVersion: current?.engineHash ?? null },
      });
    }

    return requested;
  }

  const current = await findCurrentSimVersion(db);

  const currentSimVersion = current?.engineHash ?? null;

  if (version === undefined) {
    throw errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion } });
  }

  throw errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion } });
}

/**
 * Whether `row`'s engine can derive and replay `contentVersion` — content versions are
 * server-authored numeric strings, so a non-numeric value here is a bug, not caller input.
 */
function isContentVersionSupported(row: SimVersionRow, contentVersion: string): boolean {
  const requested = Number(contentVersion);
  const supported = Number(row.maxContentVersion);

  invariant(
    !Number.isNaN(requested) && !Number.isNaN(supported),
    'content versions are numeric strings',
  );

  return requested <= supported;
}
