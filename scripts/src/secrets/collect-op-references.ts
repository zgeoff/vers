import invariant from 'tiny-invariant';
import type { CollectedOPReferences, OPReference } from './types';

const SCHEME = 'op://';

// a reference is a literal vault, item and field of letters, digits, `_`, `.` and `-`, with an
// optional query; the shell joins any text glued past it, even past a closing quote, so its word
// ends at whitespace, `)` or the end of the text, directly or after one closing quote or backtick
const OP_REFERENCE_PATTERN =
  /op:\/\/(?<vault>[\w.-]+)\/(?<item>[\w.-]+)\/(?<field>[\w.-]+)(?:\?[\w=-]+)?(?=[\s)]|$|['"`](?:[\s)]|$))/uy;

// the scheme followed by a space, a quote, a backtick or the end of the text names it in prose
const SCHEME_IN_PROSE_PATTERN = /^[\s'"`]|^$/u;

export function collectOPReferences(text: string): CollectedOPReferences {
  const references: Array<OPReference> = [];
  const unparsed: Array<string> = [];

  for (let start = text.indexOf(SCHEME); start !== -1; start = text.indexOf(SCHEME, start + 1)) {
    if (
      SCHEME_IN_PROSE_PATTERN.test(text.slice(start + SCHEME.length, start + SCHEME.length + 1))
    ) {
      continue;
    }

    OP_REFERENCE_PATTERN.lastIndex = start;

    const found = OP_REFERENCE_PATTERN.exec(text);

    if (found === null) {
      unparsed.push(text.slice(start).split(/\s/u)[0] ?? SCHEME);
    } else {
      const field = found.groups?.['field'];
      const item = found.groups?.['item'];
      const vault = found.groups?.['vault'];

      invariant(
        field !== undefined && item !== undefined && vault !== undefined,
        'the pattern captures a vault, an item and a field',
      );

      references.push({ field, item, vault });
    }
  }

  return { references, unparsed };
}
