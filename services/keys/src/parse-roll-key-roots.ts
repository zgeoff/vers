import { hexToBytes } from '@noble/hashes/utils.js';
import type { Population } from '@vers/roll-crypto';
import * as z from 'zod';

/**
 * A population's custodied root secrets, keyed by version, plus the version new derivations use.
 */
interface RollKeyRootEntry {
  readonly current: number;
  readonly roots: ReadonlyMap<number, Uint8Array>;
}

export type RollKeyRoots = Readonly<Record<Population, RollKeyRootEntry>>;

const HEX_ROOT_PATTERN = /^[0-9a-f]{64}$/i;
const INTEGER_KEY_PATTERN = /^[1-9]\d*$/;

const RawRootEntrySchema = z.object({
  current: z.int().min(1),
  roots: z.record(z.string(), z.string()),
});

const RawRollKeyRootsSchema = z.object({
  'self-found': RawRootEntrySchema,
  trade: RawRootEntrySchema,
});

/**
 * Parses the `ROLL_KEY_ROOTS` env payload into decoded per-population root secrets. Fails fast on
 * any malformed field, always naming the problem and never the root material itself, so a boot
 * failure is safe to log.
 */
export function parseRollKeyRoots(raw: string): RollKeyRoots {
  const parsed = RawRollKeyRootsSchema.safeParse(parseJSON(raw));

  if (!parsed.success) {
    throw new Error(`invalid ROLL_KEY_ROOTS: ${z.prettifyError(parsed.error)}`);
  }

  return {
    'self-found': parsePopulationEntry('self-found', parsed.data['self-found']),
    trade: parsePopulationEntry('trade', parsed.data.trade),
  };
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('invalid ROLL_KEY_ROOTS: malformed JSON');
  }
}

interface RawRootEntry {
  readonly current: number;
  readonly roots: Readonly<Record<string, string>>;
}

function parsePopulationEntry(population: Population, entry: RawRootEntry): RollKeyRootEntry {
  const roots = new Map<number, Uint8Array>();

  for (const [rawVersion, rawRoot] of Object.entries(entry.roots)) {
    if (!INTEGER_KEY_PATTERN.test(rawVersion)) {
      throw new Error(
        `invalid ROLL_KEY_ROOTS: population "${population}" has a non-integer key version "${rawVersion}"`,
      );
    }

    if (!HEX_ROOT_PATTERN.test(rawRoot)) {
      throw new Error(
        `invalid ROLL_KEY_ROOTS: population "${population}" key version ${rawVersion} is not 64-character hex`,
      );
    }

    roots.set(Number(rawVersion), hexToBytes(rawRoot));
  }

  if (!roots.has(entry.current)) {
    throw new Error(
      `invalid ROLL_KEY_ROOTS: population "${population}" current version ${entry.current} has no matching root`,
    );
  }

  return { current: entry.current, roots };
}
