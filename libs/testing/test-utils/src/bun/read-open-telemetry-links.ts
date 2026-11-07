import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

export interface OpenTelemetryLink {
  name: string;
  owner: string;
  range: string;
  version: string;
}

export function readOpenTelemetryLinks(
  packageName: string,
  fromDirectory: string,
): Array<OpenTelemetryLink> {
  const rootDirectory = resolvePackageDirectory(packageName, fromDirectory);

  if (rootDirectory === null) {
    throw new Error(`${packageName} is not installed under ${fromDirectory}`);
  }

  const scope = `${packageName.split('/')[0]}/`;
  const links: Array<OpenTelemetryLink> = [];

  const visited = new Set<string>();

  const pending = [rootDirectory];

  for (
    let packageDirectory = pending.pop();
    packageDirectory !== undefined;
    packageDirectory = pending.pop()
  ) {
    if (visited.has(packageDirectory)) {
      continue;
    }

    visited.add(packageDirectory);

    const manifest = readManifest(packageDirectory);

    for (const [name, range] of collectDeclaredRanges(manifest)) {
      const linkedDirectory = resolvePackageDirectory(name, packageDirectory);

      if (linkedDirectory !== null && name.startsWith(scope)) {
        pending.push(linkedDirectory);
      }

      if (linkedDirectory !== null && name.startsWith('@opentelemetry/')) {
        const linked = readManifest(linkedDirectory);

        links.push({ name, owner: manifest.name, range, version: linked.version });
      }
    }
  }

  return links;
}

function resolvePackageDirectory(name: string, fromDirectory: string): string | null {
  for (let directory = fromDirectory; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);

    if (existsSync(join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }

    if (dirname(directory) === directory) {
      return null;
    }
  }
}

const ManifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  name: z.string(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  version: z.string(),
});

type Manifest = z.infer<typeof ManifestSchema>;

function readManifest(packageDirectory: string): Manifest {
  const text = readFileSync(join(packageDirectory, 'package.json'), 'utf8');

  return ManifestSchema.parse(JSON.parse(text));
}

function collectDeclaredRanges(manifest: Manifest): Array<[string, string]> {
  return [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.optionalDependencies ?? {}),
    ...Object.entries(manifest.peerDependencies ?? {}),
  ];
}
