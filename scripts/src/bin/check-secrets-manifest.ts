import { readFile } from 'node:fs/promises';
import { $ } from 'bun';
import { z } from 'zod';
import { collectJSONStrings } from '../secrets/collect-json-strings';
import { collectManifestGaps } from '../secrets/collect-manifest-gaps';
import { collectOPReferences } from '../secrets/collect-op-references';
import { formatOPReference } from '../secrets/format-op-reference';
import { parseSecretsManifest } from '../secrets/parse-secrets-manifest';
import type { OPReferenceSource } from '../secrets/types';

const MANIFEST_PATH = 'secrets-manifest.json';
const READER_PATHS = ['.mcp.json', '.github', 'infra'];
const READERS = READER_PATHS.join(', ');

const manifestText = await readFile(MANIFEST_PATH, 'utf8');

const manifestDocument: unknown = JSON.parse(manifestText);
const parsedManifest = parseSecretsManifest(manifestDocument);

if (!parsedManifest.success) {
  console.error(`✗ ${MANIFEST_PATH} is malformed: ${z.prettifyError(parsedManifest.error)}`);
  process.exit(1);
}

const trackedList = await $`git ls-files -z -- ${READER_PATHS}`.text();

const sources: Array<OPReferenceSource> = [];
let failed = false;

for (const path of trackedList.split('\0').filter((entry) => entry !== '')) {
  const text = await readFile(path, 'utf8');

  // a JSON string escapes its quotes, and a raw scan would read the backslash into the field name;
  // a tsconfig holds comments, which only the JSONC parser accepts
  const scanned = path.endsWith('.json')
    ? collectJSONStrings(Bun.JSONC.parse(text)).join('\n')
    : text;

  const collected = collectOPReferences(scanned);

  for (const reference of collected.unparsed) {
    console.error(`✗ ${path} holds ${reference}, which is not a literal op://vault/item/field`);

    failed = true;
  }

  sources.push({ path, references: collected.references });
}

const gaps = collectManifestGaps(parsedManifest.data, sources);

for (const gap of gaps.unlisted) {
  console.error(
    `✗ ${gap.path} reads ${formatOPReference(gap.reference)}, which ${MANIFEST_PATH} lacks`,
  );
}

for (const reference of gaps.unread) {
  console.error(`✗ ${MANIFEST_PATH} lists ${formatOPReference(reference)}, which nothing reads`);
}

if (failed || gaps.unlisted.length > 0 || gaps.unread.length > 0) {
  console.error(`list in ${MANIFEST_PATH} each 1Password reference that ${READERS} read`);

  process.exitCode = 1;
} else {
  console.log(`✓ ${MANIFEST_PATH} lists every 1Password reference that ${READERS} read`);
}
