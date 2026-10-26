import invariant from 'tiny-invariant';
import type { CollectedOPReferences, OPReference } from './types';

// a reference ends at a quote, a backtick, a closing parenthesis or the end of its line; names
// may hold spaces, and a field may sit under a section (`op://vault/item/section/field`)
const OP_REFERENCE_PATTERN = /op:\/\/(?<path>[^\s'"`)][^'"`)\n]*)/gu;

export function collectOPReferences(text: string): CollectedOPReferences {
  const references: Array<OPReference> = [];
  const unparsed: Array<string> = [];

  for (const found of text.matchAll(OP_REFERENCE_PATTERN)) {
    const path = found.groups?.['path'];

    invariant(path !== undefined, 'the pattern captures a named path');

    const reference = parseReferencePath(path);

    if (reference === null) {
      unparsed.push(found[0]);
    } else {
      references.push(reference);
    }
  }

  return { references, unparsed };
}

function parseReferencePath(path: string): OPReference | null {
  const [location = ''] = path.trimEnd().split('?');

  if (location.includes('$') || location.includes('{')) {
    return null;
  }

  const [vault, item, ...fieldSegments] = location.split('/');

  if (
    vault === undefined ||
    vault === '' ||
    item === undefined ||
    item === '' ||
    fieldSegments.length === 0 ||
    fieldSegments.length > 2 ||
    fieldSegments.includes('')
  ) {
    return null;
  }

  return { field: fieldSegments.join('/'), item, vault };
}
