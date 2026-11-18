const releases = new Set<() => Promise<void>>();

// A worker keeps one clone across its tests, so it is dropped once the worker's files are done.
// A release must leave its module ready to build a new clone, since under `--parallel` the next
// file of the worker follows.
export function registerWorkerClone(release: () => Promise<void>): void {
  releases.add(release);
}

export async function releaseWorkerClones(): Promise<void> {
  const pending = [...releases];

  releases.clear();

  await Promise.all(pending.map((release) => release()));
}
