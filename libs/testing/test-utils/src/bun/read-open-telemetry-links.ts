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

    for (const declared of collectDeclaredRanges(manifest)) {
      const isInScope = declared.name.startsWith(scope);
      const isOpenTelemetry = declared.name.startsWith('@opentelemetry/');
      const linkedDirectory = resolvePackageDirectory(declared.name, packageDirectory);

      if (linkedDirectory === null && (isInScope || isOpenTelemetry) && !declared.isOptional) {
        throw new Error(
          `${manifest.name} declares ${declared.name}, which the install does not link`,
        );
      }

      if (linkedDirectory !== null && isInScope) {
        pending.push(linkedDirectory);
      }

      if (linkedDirectory !== null && isOpenTelemetry) {
        const linked = readManifest(linkedDirectory);

        links.push({
          name: declared.name,
          owner: manifest.name,
          range: declared.range,
          version: linked.version,
        });
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

const PeerMetaSchema = z.object({ optional: z.boolean().optional() });

const ManifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  name: z.string(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  peerDependenciesMeta: z.record(z.string(), PeerMetaSchema).optional(),
  version: z.string(),
});

type Manifest = z.infer<typeof ManifestSchema>;

function readManifest(packageDirectory: string): Manifest {
  const text = readFileSync(join(packageDirectory, 'package.json'), 'utf8');

  return ManifestSchema.parse(JSON.parse(text));
}

interface DeclaredRange {
  isOptional: boolean;
  name: string;
  range: string;
}

function collectDeclaredRanges(manifest: Manifest): Array<DeclaredRange> {
  const peerMeta = manifest.peerDependenciesMeta ?? {};

  return [
    ...Object.entries(manifest.dependencies ?? {}).map(([name, range]) => ({
      isOptional: false,
      name,
      range,
    })),
    ...Object.entries(manifest.optionalDependencies ?? {}).map(([name, range]) => ({
      isOptional: true,
      name,
      range,
    })),
    ...Object.entries(manifest.peerDependencies ?? {}).map(([name, range]) => ({
      isOptional: peerMeta[name]?.optional === true,
      name,
      range,
    })),
  ];
}
