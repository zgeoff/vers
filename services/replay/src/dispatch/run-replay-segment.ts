import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type {
  ReplaySegmentInput,
  ReplaySegmentOutput,
  replayContract,
} from '@vers/contract-replay';
import type { DB } from '@vers/db';
import { createServiceToken } from '@vers/service-auth';
import { findSimVersion } from '@vers/sim-registry';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { runReplaySimulation } from '../handlers/run-replay-simulation';

export interface RunReplaySegmentDeps {
  readonly db: Kysely<DB>;

  /**
   * Signs the s2s token a remote dispatch carries; resolved and injected by the caller, never read
   * from ambient env inside this module.
   */
  readonly privateKey: CryptoKey;

  readonly simVersion: string;
}

export type RunReplaySegmentOutcome =
  | { readonly kind: 'expired' }
  | { readonly kind: 'replayed'; readonly output: ReplaySegmentOutput }
  | { readonly kind: 'unknownVersion' };

/**
 * Routes one replay job to wherever its stamped `simVersion` can run: in-process when it matches
 * this deploy's own baked engine hash, or a remote call to the registry's provider otherwise.
 * `unknownVersion` (no registry row — a newer or unrecognized stamp) and `expired` (past retention)
 * are operational outcomes for the caller to act on — parking the activity or forcing a resync —
 * never thrown. A `SIM_VERSION_MISMATCH` rejection from a resolved provider means dispatch routed
 * to the wrong deploy; that is a bug, not an operational outcome, and is left to throw.
 */
export async function runReplaySegment(
  deps: Readonly<RunReplaySegmentDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- job carries zod-inferred wire types with no readonly form
  job: ReplaySegmentInput,
): Promise<RunReplaySegmentOutcome> {
  if (job.simVersion === deps.simVersion) {
    return { kind: 'replayed', output: await runReplaySimulation(job) };
  }

  const version = await findSimVersion(deps.db, job.simVersion);

  if (version === undefined) {
    return { kind: 'unknownVersion' };
  }

  if (version.status === 'pruned' || version.retainedUntil < new Date()) {
    return { kind: 'expired' };
  }

  return { kind: 'replayed', output: await callProvider(deps, version.providerUrl, job) };
}

/**
 * Calls the registered provider's own `replaySegment` endpoint, minting a short-lived s2s token
 * scoped to the replay audience.
 */
async function callProvider(
  deps: Readonly<RunReplaySegmentDeps>,
  providerURL: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- job carries zod-inferred wire types with no readonly form
  job: ReplaySegmentInput,
): Promise<ReplaySegmentOutput> {
  const token = await createServiceToken({ audience: 'replay', privateKey: deps.privateKey });

  const client: ContractRouterClient<typeof replayContract> = createORPCClient(
    new RPCLink({ headers: { authorization: `Bearer ${token}` }, url: `${providerURL}/rpc` }),
  );

  return client.replaySegment(job);
}
