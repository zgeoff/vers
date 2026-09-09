import { removeAvatarOfflineWork } from '../submission/remove-avatar-offline-work';
import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';
import type { UndeliveredWorkInput } from './worker-contract';

export async function handleRemoveUndeliveredWorkMessage(
  context: WorkerContext,
  input: Readonly<UndeliveredWorkInput>,
): Promise<void> {
  await removeAvatarOfflineWork(input.avatarIDs);

  resetSimulation(context);
}
