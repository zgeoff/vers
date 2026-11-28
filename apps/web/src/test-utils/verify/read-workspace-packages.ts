import { join } from 'node:path';
import { z } from 'zod';
import type { WorkspacePackage } from './types';

const packageJSONSchema = z.object({
  name: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
});

// Each package of the folders that the local stack runs, with the names of the workspace packages
// it depends on at run time.
export async function readWorkspacePackages(rootDir: string): Promise<Array<WorkspacePackage>> {
  const packages: Array<WorkspacePackage> = [];

  for (const pattern of ['{services,contracts}/*/package.json', 'libs/*/*/package.json']) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: rootDir })) {
      const packageJSON: unknown = await Bun.file(join(rootDir, path)).json();

      const parsed = packageJSONSchema.parse(packageJSON);

      packages.push({
        folder: path.slice(0, -'/package.json'.length),
        name: parsed.name,
        workspaceDependencies: Object.entries(parsed.dependencies ?? {})
          .filter(([, version]) => version === 'workspace:*')
          .map(([name]) => name),
      });
    }
  }

  return packages;
}
