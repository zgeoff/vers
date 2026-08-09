import { hexToBytes } from '@noble/hashes/utils.js';
import type { SecretRef } from '@vers/contract-keys';
import * as z from 'zod';

/**
 * A scope's custodied root secrets, keyed by version, plus the version new derivations use.
 */
interface ScopeSecretRootEntry {
  readonly current: number;
  readonly roots: ReadonlyMap<number, Uint8Array>;
}

export type ScopeSecretRoots = Readonly<Record<SecretRef, ScopeSecretRootEntry>>;

const RawRootEntrySchema = z.object({
  current: z.int().min(1),
  roots: z.record(z.string(), z.string()),
});

const RawScopeSecretRootsSchema = z.object({
  worldmap: RawRootEntrySchema,
});

/**
 * Parses the `SCOPE_SECRET_ROOTS` env payload into decoded per-scope root secrets. Fails fast on
 * any malformed field, always naming the problem and never the root material itself, so a boot
 * failure is safe to log.
 */
export function parseScopeSecretRoots(raw: string): ScopeSecretRoots {
  const parsed = RawScopeSecretRootsSchema.safeParse(parseJSON(raw));

  if (!parsed.success) {
    throw new Error(`invalid SCOPE_SECRET_ROOTS: ${z.prettifyError(parsed.error)}`);
  }

  return {
    worldmap: parseScopeEntry('worldmap', parsed.data.worldmap),
  };
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('invalid SCOPE_SECRET_ROOTS: malformed JSON');
  }
}

interface RawRootEntry {
  readonly current: number;
  readonly roots: Readonly<Record<string, string>>;
}

const HEX_ROOT_PATTERN = /^[0-9a-f]{64}$/i;
const INTEGER_KEY_PATTERN = /^[1-9]\d*$/;

function parseScopeEntry(secretRef: SecretRef, entry: RawRootEntry): ScopeSecretRootEntry {
  const roots = new Map<number, Uint8Array>();

  for (const [rawVersion, rawRoot] of Object.entries(entry.roots)) {
    if (!INTEGER_KEY_PATTERN.test(rawVersion)) {
      throw new Error(
        `invalid SCOPE_SECRET_ROOTS: scope "${secretRef}" has a non-integer secret version "${rawVersion}"`,
      );
    }

    if (!HEX_ROOT_PATTERN.test(rawRoot)) {
      throw new Error(
        `invalid SCOPE_SECRET_ROOTS: scope "${secretRef}" secret version ${rawVersion} is not 64-character hex`,
      );
    }

    roots.set(Number(rawVersion), hexToBytes(rawRoot));
  }

  if (!roots.has(entry.current)) {
    throw new Error(
      `invalid SCOPE_SECRET_ROOTS: scope "${secretRef}" current version ${entry.current} has no matching root`,
    );
  }

  return { current: entry.current, roots };
}
