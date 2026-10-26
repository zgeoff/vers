import { formatOPReference } from './format-op-reference';
import type {
  OPReference,
  OPReferenceSource,
  SecretsManifest,
  SecretsManifestGaps,
  UnlistedOPReference,
} from './types';

export function collectManifestGaps(
  manifest: SecretsManifest,
  sources: ReadonlyArray<OPReferenceSource>,
): SecretsManifestGaps {
  const read = new Set<string>();

  const unlisted: Array<UnlistedOPReference> = [];

  for (const source of sources) {
    for (const reference of source.references) {
      read.add(formatOPReference(reference));

      if (!isListed(manifest, reference)) {
        unlisted.push({ path: source.path, reference });
      }
    }
  }

  const unread = collectListedReferences(manifest).filter(
    (reference) => !read.has(formatOPReference(reference)),
  );

  return { unlisted, unread };
}

function isListed(manifest: SecretsManifest, reference: OPReference): boolean {
  return manifest.vaults[reference.vault]?.[reference.item]?.includes(reference.field) ?? false;
}

function collectListedReferences(manifest: SecretsManifest): Array<OPReference> {
  return Object.entries(manifest.vaults).flatMap(([vault, items]) =>
    Object.entries(items).flatMap(([item, fields]) =>
      fields.map((field) => ({ field, item, vault })),
    ),
  );
}
