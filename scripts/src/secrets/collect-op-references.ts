import { collectShellWords } from './collect-shell-words';
import type { CollectedOPReferences, OPReference, ShellWord } from './types';

const SCHEME = 'op://';

export function collectOPReferences(text: string): CollectedOPReferences {
  const references: Array<OPReference> = [];
  const unparsed: Array<string> = [];

  for (const word of collectReferenceWords(text, 0)) {
    const scanned = word.value.slice(word.value.indexOf(SCHEME));
    const path = scanned.slice(SCHEME.length);

    // the scheme alone is prose that names it, never a reference
    if (path === '') {
      continue;
    }

    const reference = word.isComplete ? parseReferencePath(path) : null;

    if (reference === null) {
      unparsed.push(scanned);
    } else {
      references.push(reference);
    }
  }

  return { references, unparsed };
}

// a word whose text before the scheme holds a space is a command line for a nested shell, such as
// the string `sh -c` runs, so it is read once more as one; any other word is a literal value, and a
// quote inside it is part of the name
const MAX_NESTING = 2;

function collectReferenceWords(text: string, depth: number): Array<ShellWord> {
  return collectShellWords(text)
    .filter((word) => word.value.includes(SCHEME))
    .flatMap((word) =>
      depth < MAX_NESTING && isNestedCommandLine(word.value)
        ? collectReferenceWords(word.value, depth + 1).map((inner) =>
            word.isComplete ? inner : { isComplete: false, value: inner.value },
          )
        : [word],
    );
}

function isNestedCommandLine(value: string): boolean {
  return /\s/u.test(value.slice(0, value.indexOf(SCHEME)));
}

function parseReferencePath(path: string): OPReference | null {
  const [location = ''] = path.split('?');

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
