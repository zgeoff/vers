import type { WorkspacePackage } from './types';

// The folders the seeds reach: each seed, then each workspace package that a reached package
// depends on, sorted. A seed with no package, such as a folder that a change deletes, still counts.
export function collectReachedFolders(
  seedFolders: ReadonlyArray<string>,
  packages: ReadonlyArray<WorkspacePackage>,
): Array<string> {
  const byFolder = new Map(packages.map((entry) => [entry.folder, entry]));
  const byName = new Map(packages.map((entry) => [entry.name, entry]));
  const reached = new Set<string>();

  const pending = [...seedFolders];

  for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
    if (reached.has(folder)) {
      continue;
    }

    reached.add(folder);

    for (const name of byFolder.get(folder)?.workspaceDependencies ?? []) {
      const dependency = byName.get(name);

      if (dependency !== undefined) {
        pending.push(dependency.folder);
      }
    }
  }

  return [...reached].toSorted();
}
