import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

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

function buildCanonicalEncounterNode(node: HashedEncounterNode): Record<string, unknown> {
  // `Object.fromEntries` defines each key as an own property, so a node parsed from JSON with an
  // own `__proto__` key lands in the digest like any other field — plain assignment would invoke
  // the prototype setter and silently drop it.
  return Object.fromEntries(
    Object.keys(node)
      .filter((candidate) => node[candidate] !== undefined)
      .toSorted()
      .map((key) => [key, node[key]]),
  );
}
