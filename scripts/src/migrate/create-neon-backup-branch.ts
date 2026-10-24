import { z } from 'zod';
import { pickOperationState } from './pick-operation-state';
import { requestNeonJSON } from './request-neon-json';
import type { NeonBranch } from './types';

interface CreateNeonBackupBranchConfig {
  readonly apiKey: string;
  readonly projectID: string;
  readonly name: string;
  readonly expiresAt: Date;
  readonly operationPollIntervalMs: number;
  readonly operationTimeoutMs: number;
}

const branchSchema = z.object({ id: z.string(), name: z.string() });
const operationSchema = z.object({ action: z.string(), id: z.string(), status: z.string() });

const createdBranchSchema = z.object({
  branch: branchSchema,
  operations: z.array(operationSchema),
});

export async function createNeonBackupBranch(
  config: CreateNeonBackupBranchConfig,
): Promise<NeonBranch> {
  const deadline = Date.now() + config.operationTimeoutMs;

  const parent = await readProductionBranch(config);

  const payload = await requestNeonJSON({
    apiKey: config.apiKey,
    body: {
      branch: {
        // Neon stores the expiry at second precision and documents the field without fractions
        expires_at: config.expiresAt.toISOString().replace(/\.\d+Z$/u, 'Z'),
        name: config.name,
        parent_id: parent.id,
      },
    },
    method: 'POST',
    path: `/projects/${config.projectID}/branches`,
  });

  const created = createdBranchSchema.parse(payload);

  await Promise.all(
    created.operations.map((operation) => waitForOperation(config, operation.id, deadline)),
  );

  return { id: created.branch.id, name: created.branch.name };
}

const PRODUCTION_BRANCH_NAME = 'main';
const branchListSchema = z.object({ branches: z.array(branchSchema) });

async function readProductionBranch(config: CreateNeonBackupBranchConfig): Promise<NeonBranch> {
  const payload = await requestNeonJSON({
    apiKey: config.apiKey,
    method: 'GET',
    path: `/projects/${config.projectID}/branches`,
  });

  const list = branchListSchema.parse(payload);
  const branch = list.branches.find((candidate) => candidate.name === PRODUCTION_BRANCH_NAME);

  if (branch === undefined) {
    throw new Error(
      `Neon project ${config.projectID} has no branch named ${PRODUCTION_BRANCH_NAME}`,
    );
  }

  return branch;
}

const operationResponseSchema = z.object({ operation: operationSchema });

async function waitForOperation(
  config: CreateNeonBackupBranchConfig,
  operationID: string,
  deadline: number,
): Promise<void> {
  const payload = await requestNeonJSON({
    apiKey: config.apiKey,
    method: 'GET',
    path: `/projects/${config.projectID}/operations/${operationID}`,
  });

  const operation = operationResponseSchema.parse(payload).operation;
  const state = pickOperationState(operation.status);

  if (state === 'done') {
    return;
  }

  if (state === 'failed') {
    throw new Error(
      `Neon operation ${operation.id} (${operation.action}) ended ${operation.status}`,
    );
  }

  if (Date.now() >= deadline) {
    throw new Error(
      `Neon operation ${operation.id} (${operation.action}) is still ${operation.status} at the deadline`,
    );
  }

  await Bun.sleep(config.operationPollIntervalMs);

  return waitForOperation(config, operationID, deadline);
}
