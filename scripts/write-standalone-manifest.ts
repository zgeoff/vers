import fs from 'node:fs';
import path from 'node:path';

/**
 * Rewrites a workspace project manifest so npm can install it outside the
 * workspace: catalog references are inlined from the root manifest's
 * catalog, and each workspace dep is replaced by that project's own
 * external runtime deps (recursively) — the project's bundle inlines
 * workspace source but leaves registry packages external, so those are
 * what the deploy image must install.
 *
 * Usage: bun scripts/write-standalone-manifest.ts <manifest-path>
 * Must run from the repo root (reads ./package.json and projects/*).
 */
const manifestPath = process.argv[2];

if (!manifestPath) {
  throw new Error('usage: write-standalone-manifest.ts <manifest-path>');
}

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
}

const root = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  workspaces: { catalog: Record<string, string> };
};

const { catalog } = root.workspaces;

const workspaceManifests = new Map<string, Manifest>();

for (const dir of fs.readdirSync('projects')) {
  const memberPath = path.join('projects', dir, 'package.json');

  if (!fs.existsSync(memberPath)) {
    continue;
  }

  const member = JSON.parse(fs.readFileSync(memberPath, 'utf8')) as Manifest;

  if (member.name) {
    workspaceManifests.set(member.name, member);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;

manifest.dependencies = collectExternalDeps(manifest);

delete manifest.devDependencies;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

/**
 * Flattens a manifest's runtime deps into registry-installable pins:
 * catalog refs are resolved against the root catalog and workspace deps
 * are expanded into their own runtime deps, depth-first.
 */
function collectExternalDeps(
  target: Manifest,
  seen = new Set<string>(),
  collected: Record<string, string> = {},
): Record<string, string> {
  for (const [name, version] of Object.entries(target.dependencies ?? {})) {
    if (version.startsWith('workspace:')) {
      if (seen.has(name)) {
        continue;
      }

      seen.add(name);

      const member = workspaceManifests.get(name);

      if (!member) {
        throw new Error(`no workspace member named ${name}`);
      }

      collectExternalDeps(member, seen, collected);

      continue;
    }

    if (version === 'catalog:') {
      const pinned = catalog[name];

      if (!pinned) {
        throw new Error(`no catalog entry for ${name}`);
      }

      collected[name] ??= pinned;

      continue;
    }

    collected[name] ??= version;
  }

  return sortDeps(collected);
}

/** Orders dependency entries by package name for a stable manifest. */
function sortDeps(deps: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
  );
}
