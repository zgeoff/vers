import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import invariant from 'tiny-invariant';
import type { WorkerSnapshot } from './read-worker-snapshot';
import { readWorkerSnapshot } from './read-worker-snapshot';

export async function waitForLiveRun(page: Page, activityID: string): Promise<WorkerSnapshot> {
  await expect
    .poll(async () => {
      const snapshot = await readWorkerSnapshot(page);

      return snapshot?.liveRun?.activityID;
    })
    .toBe(activityID);

  const attached = await readWorkerSnapshot(page);

  invariant(attached !== null, 'a page whose worker attached a run keeps its debug hook');

  return attached;
}
