import { collectShellWords } from './collect-shell-words';
import { parseOPReferencePath } from './parse-op-reference-path';
import type { CollectedOPReferences, OPReference, ShellWord } from './types';

const SCHEME = 'op://';

// GitHub substitutes an expression before any shell runs, so its value is unknown to the scan
const GITHUB_EXPRESSION_PATTERN = /\$\{\{[\s\S]*?\}\}/gu;

// a reference stands alone in its word or behind an assignment or flag name, as in `TOKEN=` or
// `--token=`; any other text before it, such as an expansion or prose, changes what is read
const REFERENCE_PREFIX_PATTERN = /^(?:-{0,2}[A-Za-z_][\w-]*=)?$/u;

export function collectOPReferences(text: string): CollectedOPReferences {
  const references: Array<OPReference> = [];
  const unparsed: Array<string> = [];

  for (const expression of text.match(GITHUB_EXPRESSION_PATTERN) ?? []) {
    if (expression.includes(SCHEME)) {
      unparsed.push(expression);
    }
  }

  for (const word of collectReferenceWords(text.replaceAll(GITHUB_EXPRESSION_PATTERN, '$'), 0)) {
    const start = word.value.indexOf(SCHEME);
    const path = word.value.slice(start + SCHEME.length);

    // the scheme alone is prose that names it, never a reference
    if (path === '') {
      continue;
    }

    const isInContext = REFERENCE_PREFIX_PATTERN.test(word.value.slice(0, start));
    const reference = word.isComplete && isInContext ? parseOPReferencePath(path) : null;

    if (reference === null) {
      const reported = isInContext ? word.value.slice(start) : word.value;

      unparsed.push(reported);
    } else {
      references.push(reference);
    }
  }

  return { references, unparsed };
}

// the word after `-c` is the command line a nested shell runs, as in `sh -c "op read …"`, so it is
// read once more as one; any other word is a literal value, and a quote inside it is part of the
// name
const MAX_NESTING = 2;

function collectReferenceWords(text: string, depth: number): Array<ShellWord> {
  const words = collectShellWords(text);

  return words.flatMap((word, index) => {
    if (!word.value.includes(SCHEME)) {
      return [];
    }

    if (depth >= MAX_NESTING || words[index - 1]?.value !== '-c') {
      return [word];
    }

    return collectReferenceWords(word.value, depth + 1).map((inner) =>
      word.isComplete ? inner : { isComplete: false, value: inner.value },
    );
  });
}
