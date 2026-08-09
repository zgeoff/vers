import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * The frozen encounter params folded into the start hash: `difficulty` is always present, and any
 * further sealed field is a string or number so it serializes canonically.
 */
interface HashedEncounterNode {
  readonly [key: string]: number | string | undefined;
  readonly difficulty: number;
}

interface BuildStartHashInput {
  readonly contentVersion: string;
  readonly encounterNode: HashedEncounterNode;
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

/**
 * `Object.fromEntries` defines each key as an own property, so a node parsed from JSON with an own
 * `__proto__` key lands in the digest like any other field — plain assignment would invoke the
 * prototype setter and silently drop it.
 */
function buildCanonicalEncounterNode(node: HashedEncounterNode): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(node)
      .filter((candidate) => node[candidate] !== undefined)
      .toSorted()
      .map((key) => [key, node[key]]),
  );
}
