import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import type { CheckpointSubmitter } from '../../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../../submission/types';
import type { WorkerContext } from '../../worker/types';

interface CreateMockWorkerContextOptions {
  readonly client?: ActivityServiceClient;
  readonly connections?: ReadonlyArray<MessagePort>;
  readonly remainingBudgetMs?: number;
  readonly submitter?: Readonly<CheckpointSubmitter>;
}

export function createMockWorkerContext(
  options: Readonly<CreateMockWorkerContextOptions> = {},
): WorkerContext {
  const connections = new Set(options.connections);

  const client: ActivityServiceClient =
    options.client ??
    createORPCClient(new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` }));

  const submitter: CheckpointSubmitter = options.submitter ?? {
    flushHeld: () => Promise.resolve(),
    registerActivity: () => Promise.resolve(),
    submit: () => Promise.resolve(),
  };

  let simulation: null | Simulation = null;
  let activity: ActivityData | null = null;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;

  return {
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getRemainingBudgetMs: () => options.remainingBudgetMs ?? Number.MAX_SAFE_INTEGER,
    getResyncAvatarID: () => resyncAvatarID,
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    isResyncInFlight: () => resyncInFlight,
    removeConnection: (port) => {
      connections.delete(port);
    },
    setActivity: (newActivity) => {
      activity = newActivity;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setResyncInFlight: (inFlight) => {
      resyncInFlight = inFlight;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };
}
