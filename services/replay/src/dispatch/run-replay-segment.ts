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

export interface RunReplaySegmentDeps {
  readonly db: Kysely<DB>;

  readonly privateKey: CryptoKey;

  readonly simVersion: string;

  readonly timeoutMs?: number;
}

export type RunReplaySegmentOutcome =
  | { readonly kind: 'expired' }
  | { readonly kind: 'providerUnavailable' }
  | { readonly kind: 'replayed'; readonly output: ReplaySegmentOutput }
  | { readonly kind: 'unknownVersion' };

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
    // a defined error is a genuine misroute; a timeout, a refused connection, and a proxy 5xx
    // answering for a provider that is still booting all arrive as undefined errors
    if (isDefinedError(error)) {
      throw error;
    }

    return { kind: 'providerUnavailable' };
  }
}

const DEFAULT_PROVIDER_DISPATCH_TIMEOUT_MS = 15_000;

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
