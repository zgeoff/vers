import { hexToBytes } from '@noble/hashes/utils.js';
import * as z from 'zod';
import type { KeyRoots } from './types';

const HEX_ROOT_PATTERN = /^[0-9a-f]{64}$/i;
const INTEGER_KEY_PATTERN = /^[1-9]\d*$/;

// the same entry contract service-keys parses at boot, so a payload the service refuses fails here
const RootEntrySchema = z.object({
  current: z.int().min(1),
  roots: z.record(
    z.string().regex(INTEGER_KEY_PATTERN, 'secret versions are positive integers'),
    z.string().regex(HEX_ROOT_PATTERN, 'a root is 64-character hex'),
  ),
});

const ScopeSecretRootsSchema = z.object({ worldmap: RootEntrySchema });
const RollKeyRootsSchema = z.object({ trade: RootEntrySchema });

interface RootEntry {
  readonly current: number;
  readonly roots: Readonly<Record<string, string>>;
}

export interface ParseKeyRootsInput {
  readonly rollKeyRoots: string;
  readonly scopeSecretRoots: string;
}

export interface KeyRootVersions {
  readonly keyVersion: number;
  readonly secretVersion: number;
}

export function parseKeyRoots(
  input: Readonly<ParseKeyRootsInput>,
  versions: Readonly<KeyRootVersions>,
): KeyRoots {
  const scope = ScopeSecretRootsSchema.safeParse(
    parseJSON('SCOPE_SECRET_ROOTS', input.scopeSecretRoots),
  );

  if (!scope.success) {
    throw new Error(`invalid SCOPE_SECRET_ROOTS: ${z.prettifyError(scope.error)}`);
  }

  const roll = RollKeyRootsSchema.safeParse(parseJSON('ROLL_KEY_ROOTS', input.rollKeyRoots));

  if (!roll.success) {
    throw new Error(`invalid ROLL_KEY_ROOTS: ${z.prettifyError(roll.error)}`);
  }

  return {
    rollKeyRoot: pickRoot('ROLL_KEY_ROOTS', 'trade', roll.data.trade, versions.keyVersion),
    scopeSecretRoot: pickRoot(
      'SCOPE_SECRET_ROOTS',
      'worldmap',
      scope.data.worldmap,
      versions.secretVersion,
    ),
  };
}

function parseJSON(name: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`invalid ${name}: malformed JSON`);
  }
}

function pickRoot(name: string, entry: string, parsed: RootEntry, version: number): Uint8Array {
  if (parsed.roots[String(parsed.current)] === undefined) {
    throw new Error(
      `invalid ${name}: "${entry}" current version ${parsed.current} has no matching root`,
    );
  }

  const root = parsed.roots[String(version)];

  if (root === undefined) {
    throw new Error(`${name} has no "${entry}" root for version ${version}`);
  }

  return hexToBytes(root);
}
