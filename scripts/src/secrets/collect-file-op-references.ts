import { parseAllDocuments } from 'yaml';
import { collectOPReferences } from './collect-op-references';
import { collectStringValues } from './collect-string-values';
import { parseOPReferencePath } from './parse-op-reference-path';
import type { CollectedOPReferences } from './types';

export function collectFileOPReferences(path: string, text: string): CollectedOPReferences {
  const values = findStructuredValues(path, text);

  if (values === null) {
    return collectOPReferences(text);
  }

  const collected = values.map((value) =>
    isLiteralReference(value) ? collectLiteralReference(value) : collectOPReferences(value),
  );

  return {
    references: collected.flatMap((entry) => entry.references),
    unparsed: collected.flatMap((entry) => entry.unparsed),
  };
}

// JSON and YAML escape quotes in their own syntax, so the scan reads their decoded string values;
// a tsconfig holds comments, which only the JSONC parser accepts
function findStructuredValues(path: string, text: string): Array<string> | null {
  if (path.endsWith('.json')) {
    return collectStringValues(Bun.JSONC.parse(text));
  }

  if (!path.endsWith('.yml') && !path.endsWith('.yaml')) {
    return null;
  }

  const documents = parseAllDocuments(text);
  const broken = documents.find((document) => document.errors.length > 0);

  if (broken !== undefined) {
    throw new Error(`${path} is not valid YAML: ${broken.errors.map(String).join('; ')}`);
  }

  return documents.flatMap((document) => collectStringValues(document.toJS()));
}

const SCHEME = 'op://';

// a decoded value that is one reference reaches its reader as it stands, such as a workflow env
// value or an argv entry, so no shell splits it or reads its quotes
function isLiteralReference(value: string): boolean {
  return value.startsWith(SCHEME) && !value.includes('\n');
}

function collectLiteralReference(value: string): CollectedOPReferences {
  const path = value.slice(SCHEME.length);

  if (path === '') {
    return { references: [], unparsed: [] };
  }

  const reference = parseOPReferencePath(path);

  return reference === null
    ? { references: [], unparsed: [value] }
    : { references: [reference], unparsed: [] };
}
