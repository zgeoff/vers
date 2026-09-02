import type { ContractRouterClient } from '@orpc/contract';
import type { WorkerContract } from '../worker/worker-contract';

export type WorkerClient = ContractRouterClient<WorkerContract>;
