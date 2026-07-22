import { createORPCClient, isDefinedError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type {
  ReplaySegmentInput,
  ReplaySegmentOutput,
  replayContract,
} from '@vers/contract-replay';
import type { DB } from '@vers/db';
import { createServiceToken } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import { findSimVersion } from '@vers/sim-registry';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { runReplaySimulation } from '../handlers/run-replay-simulation';

/**
 * Bounds one provider dispatch, so a provider stuck mid-boot fails the call rather than holding
 * the caller's claim transaction forever. Applied fresh to each of the two dispatches a
 * cross-version segment can make (initial replay, fresh confirm) rather than a shared deadline
 * across both — worst case, a claim transaction that dispatches twice holds the lock for roughly
 * twice this bound.
 */
const DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS = 15_000;

export interface RunReplaySegmentDeps {
  readonly db: Kysely<DB>;

  /**
   * Signs the s2s token a remote dispatch carries; resolved and injected by the caller, never read
   * from ambient env inside this module.
   */
  readonly privateKey: CryptoKey;

  readonly simVersion: string;

  /**
   * Overrides `DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS` for a remote provider dispatch.
   */
  readonly timeoutMs?: number;
}

export type RunReplaySegmentOutcome =
  | { readonly kind: 'expired' }
  | { readonly kind: 'providerUnavailable' }
  | { readonly kind: 'replayed'; readonly output: ReplaySegmentOutput }
  | { readonly kind: 'unknownVersion' };

/**
 * Routes one replay job to wherever its stamped `simVersion` can run: in-process when it matches
 * this deploy's own baked engine hash, or a remote call to the registry's provider otherwise.
 * `unknownVersion` (no registry row — a newer or unrecognized stamp), `expired` (past retention),
 * and `providerUnavailable` (the remote dispatch timed out, couldn't connect, or the provider
 * answered with an undefined error such as a proxy 5xx) are operational outcomes for the caller to
 * act on — parking the activity or forcing a resync — never thrown. A `SIM_VERSION_MISMATCH`
 * rejection from a resolved provider means dispatch routed to the wrong deploy; that is a bug, not
 * an operational outcome, and is left to throw.
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

  try {
    const output = await sendProviderReplaySegment(deps, version.providerUrl, job);

    return { kind: 'replayed', output };
  } catch (error) {
    if (isDefinedError(error)) {
      throw error;
    }

    return { kind: 'providerUnavailable' };
  }
}

/**
 * Calls the registered provider's own `replaySegment` endpoint, minting a short-lived s2s token
 * scoped to the replay audience. A defined contract error (a genuine misroute) and an undefined
 * one (timeout, connection failure, or a proxy answering for a provider that isn't up yet) both
 * reach the caller as a thrown error — the caller distinguishes them.
 */
async function sendProviderReplaySegment(
  deps: Readonly<RunReplaySegmentDeps>,
  providerURL: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- job carries zod-inferred wire types with no readonly form
  job: ReplaySegmentInput,
): Promise<ReplaySegmentOutput> {
  const token = await createServiceToken({
    audience: 'replay',
    issuer: 'service-replay',
    privateKey: deps.privateKey,
  });

  const client: ContractRouterClient<typeof replayContract> = createORPCClient(
    new RPCLink({
      clientInterceptors: [buildTracingInterceptor()],
      headers: { authorization: `Bearer ${token}` },
      url: `${providerURL}/rpc`,
    }),
  );

  return client.replaySegment(job, {
    signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS),
  });
}
