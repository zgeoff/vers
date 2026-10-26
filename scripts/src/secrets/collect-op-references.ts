import invariant from 'tiny-invariant';
import type { CollectedOPReferences, OPReference } from './types';

// a quoted reference runs to its closing quote; a bare one ends at a shell operator, a ` #`
// comment or the next reference, never at a space, because an env file holds names with spaces
// unquoted
const OP_REFERENCE_PATTERN = new RegExp(
  [
    String.raw`\\"op://(?<escaped>[^"\\\n]*)\\"`,
    String.raw`\$'op://(?<ansi>(?:\\.|[^'\\\n])*)'`,
    String.raw`'op://(?<single>[^'\n]*)'`,
    String.raw`"op://(?<double>(?:\\.|[^"\\\n])*)"`,
    String.raw`op://(?<bare>[^\s'"\x60()&;<>|\\](?:(?!\s+#|op://)[^\n'"\x60()&;<>|\\])*)`,
  ].join('|'),
  'gu',
);

// the shell joins text glued to a closing quote into the same word, so the name runs on past it
const GLUED_TEXT_PATTERN = /^[^\s'"`()&;<>|,\]}]+/u;

export function collectOPReferences(text: string): CollectedOPReferences {
  const references: Array<OPReference> = [];
  const unparsed: Array<string> = [];

  for (const found of text.matchAll(OP_REFERENCE_PATTERN)) {
    const isBare = found.groups?.['bare'] !== undefined;

    const glued = isBare
      ? ''
      : (GLUED_TEXT_PATTERN.exec(text.slice(found.index + found[0].length))?.[0] ?? '');

    const path = glued === '' ? findReferencePath(found.groups) : null;
    const reference = path === null ? null : parseReferencePath(path);

    if (reference === null) {
      unparsed.push(`${found[0]}${glued}`);
    } else {
      references.push(reference);
    }
  }

  return { references, unparsed };
}

function findReferencePath(groups: Readonly<Record<string, string | undefined>> | undefined) {
  const escaped = groups?.['escaped'] ?? groups?.['single'];

  if (escaped !== undefined) {
    return escaped;
  }

  const ansi = groups?.['ansi'];

  if (ansi !== undefined) {
    return /\\[^'"\\]/u.test(ansi) ? null : ansi.replaceAll(/\\(?<kept>.)/gu, '$<kept>');
  }

  const double = groups?.['double'];

  if (double !== undefined) {
    return double.replaceAll(/\\(?<kept>[\\"$`])/gu, '$<kept>');
  }

  const bare = groups?.['bare'];

  invariant(bare !== undefined, 'the pattern captures one named path per alternative');

  return bare.trimEnd();
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
