import type { ContractRouterClient } from '@orpc/contract';
import type { WorkerContract } from '../worker/worker-contract';

/**
 * The tab's typed handle onto the worker's RPC surface, over whichever transport carries it: a
 * real `SharedWorker` port, or a structural port bridging to an elected web-locks writer.
 */
export type WorkerClient = ContractRouterClient<WorkerContract>;
