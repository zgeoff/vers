import { removeOfflineWork } from '../submission/remove-offline-work';
import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';

export async function handleRemoveUndeliveredWorkMessage(context: WorkerContext): Promise<void> {
  await removeOfflineWork();

  resetSimulation(context);
}
