import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

interface BuildStartHashInput {
  readonly contentVersion: string;
  readonly encounterNode: Readonly<Record<string, unknown>>;
  readonly keyVersion: number;
  readonly seed: string;
  readonly simVersion: string;
}

/**
 * The checkpoint hash chain's root: a sha256 hex digest over the canonical field order
 * `[seed, simVersion, contentVersion, keyVersion, encounterNode]`, seeding `last_hash` before the
 * first checkpoint links onto it. The activity's own id carries no cryptographic role and is
 * excluded: `(seed, versions, encounterNode)` already uniquely identifies the stream,
 * and the chain never needs the id to reproduce it — the client computes every continuation's seed
 * and hash from the appended chain alone, online and offline alike. `encounterNode` serializes
 * every defined key in sorted order, key insertion order irrelevant, so a richer descriptor can
 * extend it later without another format change.
 */
export function buildStartHash(input: Readonly<BuildStartHashInput>): string {
  const canonical = JSON.stringify([
    input.seed,
    input.simVersion,
    input.contentVersion,
    input.keyVersion,
    buildCanonicalEncounterNode(input.encounterNode),
  ]);

  return bytesToHex(sha256(utf8ToBytes(canonical)));
}

function buildCanonicalEncounterNode(
  node: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};

  for (const key of Object.keys(node)
    .filter((candidate) => node[candidate] !== undefined)
    .toSorted()) {
    canonical[key] = node[key];
  }

  return canonical;
}
