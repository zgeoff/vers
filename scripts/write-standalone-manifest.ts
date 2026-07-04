import fs from 'node:fs';
import path from 'node:path';

/**
 * Rewrites a workspace project manifest so npm can install it outside the
 * workspace: catalog references are inlined from the root manifest's
 * catalog, and each workspace dep is replaced by that project's own
 * external runtime deps (recursively) — the project's bundle inlines
 * workspace source but leaves registry packages external, so those are
 * what the deploy image must install. Peer and optional deps of expanded
 * members are included the same way (a peer a member relies on at runtime
 * must exist in the image). Any specifier that cannot be resolved to a
 * registry pin is an error, never silently dropped, as is a version
 * conflict between contributors.
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
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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
 * Flattens a manifest's runtime deps (dependencies plus, for expanded
 * workspace members, peer and optional deps) into registry-installable
 * pins: catalog refs resolve against the root catalog and workspace deps
 * expand into their own runtime deps, depth-first. Throws on unresolvable
 * specifiers and on version conflicts between contributors.
 */
function collectExternalDeps(
  target: Manifest,
  seen = new Set<string>(),
  collected: Record<string, string> = {},
): Record<string, string> {
  const groups = [
    target.dependencies ?? {},
    // the entry manifest's own peers/optionals are its consumers' concern;
    // expanded members' peers/optionals must land in the deploy image
    ...(seen.size > 0
      ? [target.peerDependencies ?? {}, target.optionalDependencies ?? {}]
      : []),
  ];

  for (const group of groups) {
    for (const [name, version] of Object.entries(group)) {
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

      const pinned = version === 'catalog:' ? catalog[name] : version;

      if (!pinned) {
        throw new Error(`no catalog entry for ${name}`);
      }

      if (pinned.startsWith('catalog:') || pinned.startsWith('workspace:')) {
        throw new Error(`unresolvable specifier for ${name}: ${pinned}`);
      }

      if (name in collected && collected[name] !== pinned) {
        throw new Error(
          `version conflict for ${name}: ${collected[name]} vs ${pinned}`,
        );
      }

      collected[name] = pinned;
    }
  }

  return sortDeps(collected);
}

/** Orders dependency entries by package name for a stable manifest. */
function sortDeps(deps: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
  );
}
