import type { DB } from '@vers/db';
import type { SimVersionRow } from '@vers/sim-registry';
import { findCurrentSimVersion, findSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { recordContentIncompatibleRejection } from './metrics/record-content-incompatible-rejection';
import type { SimVersionProblemPayload } from './types';

interface SimVersionStampErrors {
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

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

function isContentVersionSupported(row: SimVersionRow, contentVersion: string): boolean {
  const requested = Number(contentVersion);
  const supported = Number(row.maxContentVersion);

  invariant(
    !Number.isNaN(requested) && !Number.isNaN(supported),
    'content versions are numeric strings',
  );

  return requested <= supported;
}
