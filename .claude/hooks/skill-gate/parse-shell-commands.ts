import type { ShellCommand, ShellRedirect, ShellWord } from './types.ts';

// Parses a Bash command line into its simple commands, or null on an unclosed quote. A word with a
// parameter, a substitution or an unquoted glob is not literal, so no caller reads it as a path. A
// here document's body becomes the command's stdin.
export function parseShellCommands(text: string): readonly ShellCommand[] | null {
  const tokens = splitShellTokens(text);

  return tokens === null ? null : buildShellCommands(tokens);
}

type ShellToken =
  | { readonly kind: 'word'; readonly word: ShellWord }
  | { readonly kind: 'separator'; readonly operator: string }
  | { readonly kind: 'subshell'; readonly opens: boolean }
  | { readonly kind: 'redirect'; readonly operator: string }
  | { readonly kind: 'heredoc'; readonly body: string };

interface PendingHeredoc {
  readonly delimiter: string;
  readonly stripTabs: boolean;
}

function splitShellTokens(text: string): ShellToken[] | null {
  const tokens: ShellToken[] = [];
  const heredocs: PendingHeredoc[] = [];
  let heredocOperator: string | null = null;
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (char === ' ' || char === '\t') {
      index += 1;
    } else if (char === '\\' && text.charAt(index + 1) === '\n') {
      index += 2;
    } else if (char === '\n') {
      index += 1;

      for (const heredoc of heredocs.splice(0)) {
        const end = getHeredocEndOrTextEnd(text, index, heredoc);

        tokens.push({ kind: 'heredoc', body: text.slice(index, end.bodyEnd) });

        index = end.next;
      }

      tokens.push({ kind: 'separator', operator: '\n' });
    } else if (char === '#') {
      const lineEnd = text.indexOf('\n', index);

      index = lineEnd === -1 ? text.length : lineEnd;
    } else {
      const operator = findOperator(text, index);

      if (operator === null) {
        const parsed = parseShellWord(text, index);

        if (parsed === null) {
          return null;
        }

        index = parsed.end;

        if (heredocOperator !== null) {
          heredocs.push({ delimiter: parsed.word.text, stripTabs: heredocOperator === '<<-' });

          heredocOperator = null;
        }

        // A file descriptor number such as the 2 in `2>err.log` belongs to the redirect after it.
        if (!(isFileDescriptor(parsed.word) && isRedirectStart(text.charAt(index)))) {
          tokens.push({ kind: 'word', word: parsed.word });
        }
      } else {
        index += operator.length;
        heredocOperator = operator === '<<' || operator === '<<-' ? operator : null;

        tokens.push(buildOperatorToken(operator));
      }
    }
  }

  return tokens;
}

function getHeredocEndOrTextEnd(
  text: string,
  start: number,
  heredoc: PendingHeredoc,
): { readonly bodyEnd: number; readonly next: number } {
  let lineStart = start;

  while (lineStart < text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd);

    if ((heredoc.stripTabs ? line.replace(/^\t+/u, '') : line) === heredoc.delimiter) {
      return { bodyEnd: lineStart, next: lineEnd };
    }

    lineStart = lineEnd + 1;
  }

  return { bodyEnd: text.length, next: text.length };
}

// Longest first, so `>>` wins over `>` and `&&` over `&`.
const OPERATORS = [
  '&>>',
  '<<-',
  '<<<',
  '>>',
  '>|',
  '&>',
  '>&',
  '<&',
  '<>',
  '<<',
  '&&',
  '||',
  '|&',
  ';;',
  '>',
  '<',
  '|',
  '&',
  ';',
  '(',
  ')',
];

const SEPARATORS = new Set(['&&', '||', '|&', ';;', '|', '&', ';']);

function buildOperatorToken(operator: string): ShellToken {
  if (operator === '(' || operator === ')') {
    return { kind: 'subshell', opens: operator === '(' };
  }

  return SEPARATORS.has(operator)
    ? { kind: 'separator', operator }
    : { kind: 'redirect', operator };
}

function findOperator(text: string, index: number): string | null {
  return OPERATORS.find((operator) => text.startsWith(operator, index)) ?? null;
}

function parseShellWord(
  text: string,
  start: number,
): { readonly word: ShellWord; readonly end: number } | null {
  let value = '';
  let literal = true;
  let index = start;

  while (index < text.length && !isWordEnd(text.charAt(index))) {
    const char = text.charAt(index);

    if (char === '\\') {
      value += text.charAt(index + 1);
      index += 2;
    } else if (char === "'") {
      const close = text.indexOf("'", index + 1);

      if (close === -1) {
        return null;
      }

      value += text.slice(index + 1, close);
      index = close + 1;
    } else if (char === '"') {
      const quoted = parseDoubleQuoted(text, index + 1);

      if (quoted === null) {
        return null;
      }

      value += quoted.value;
      literal &&= quoted.literal;
      index = quoted.end;
    } else if (char === '$' || char === '`') {
      const end = findExpansionEnd(text, index);

      if (end === null) {
        return null;
      }

      literal = false;
      index = end;
    } else {
      if (GLOB_CHARS.includes(char) || (char === '~' && index === start)) {
        literal = false;
      }

      value += char;
      index += 1;
    }
  }

  return { word: { text: value, literal }, end: index };
}

function isWordEnd(char: string): boolean {
  return ' \t\n;&|<>()'.includes(char);
}

function parseDoubleQuoted(
  text: string,
  start: number,
): { readonly value: string; readonly literal: boolean; readonly end: number } | null {
  let value = '';
  let literal = true;
  let index = start;

  while (index < text.length) {
    const char = text.charAt(index);

    if (char === '"') {
      return { value, literal, end: index + 1 };
    }

    if (char === '\\' && '"\\$`\n'.includes(text.charAt(index + 1))) {
      value += text.charAt(index + 1);
      index += 2;
    } else if (char === '$' || char === '`') {
      const end = findExpansionEnd(text, index);

      if (end === null) {
        return null;
      }

      literal = false;
      index = end;
    } else {
      value += char;
      index += 1;
    }
  }

  return null;
}

// Finds where a `$name`, `${…}`, `$(…)` or backtick expansion that starts at `index` ends.
function findExpansionEnd(text: string, index: number): number | null {
  if (text.charAt(index) === '`') {
    const close = text.indexOf('`', index + 1);

    return close === -1 ? null : close + 1;
  }

  const next = text.charAt(index + 1);

  if (next === '(' || next === '{') {
    return findGroupEnd(text, index + 1);
  }

  const name = /^(?:[A-Za-z_]\w*|[0-9?#@*$!-])/u.exec(text.slice(index + 1));

  return index + 1 + (name?.[0].length ?? 0);
}

// Finds the end of the bracket group that opens at `index`, past nested groups and quoted text.
function findGroupEnd(text: string, index: number): number | null {
  let depth = 0;
  let cursor = index;

  while (cursor < text.length) {
    const char = text.charAt(cursor);

    if (char === "'") {
      const close = text.indexOf("'", cursor + 1);

      if (close === -1) {
        return null;
      }

      cursor = close + 1;
    } else {
      depth += getDepthChange(char);
      cursor += char === '\\' ? 2 : 1;

      if (depth === 0) {
        return cursor;
      }
    }
  }

  return null;
}

function getDepthChange(char: string): number {
  if ('({'.includes(char)) {
    return 1;
  }

  return ')}'.includes(char) ? -1 : 0;
}

const GLOB_CHARS = '*?[{';

function isFileDescriptor(word: ShellWord): boolean {
  return word.literal && /^\d+$/u.test(word.text);
}

function isRedirectStart(char: string): boolean {
  return char === '<' || char === '>';
}

interface CommandDraft {
  words: ShellWord[];
  redirects: ShellRedirect[];
  stdin: string | null;
  enters: number;
  leaves: number;
}

// A subshell's opening counts toward the next command's `enters`, and its closing toward the last
// command's `leaves`. A pipe side and a list sent to the background run in their own subshell too,
// so a caller can restore the state they changed, such as the directory.
function buildShellCommands(tokens: readonly ShellToken[]): readonly ShellCommand[] {
  const commands: CommandDraft[] = [];
  const heredocOwners: CommandDraft[] = [];
  let draft = buildCommandDraft();
  let operator: string | null = null;
  let pipedIn = false;

  // The index of the first command in the current list, one entry for each open subshell.
  const listStarts = [0];

  // Closes the draft at a separator. A command on either side of a pipe enters and leaves one more
  // subshell, and so does the whole list before `&`, such as `cd docs && make &`.
  const collectDraft = (separator: string | null): void => {
    const pipedOut = separator === '|' || separator === '|&';

    if (draft.words.length > 0 || draft.redirects.length > 0) {
      const piped = pipedIn || pipedOut;

      draft.enters += piped ? 1 : 0;
      draft.leaves += piped ? 1 : 0;

      commands.push(draft);

      draft = buildCommandDraft();
    }

    operator = null;
    pipedIn = pipedOut;

    const listStart = listStarts.at(-1) ?? 0;
    const first = commands[listStart];
    const last = commands.at(-1);

    if (separator === '&' && first !== undefined && last !== undefined) {
      first.enters += 1;
      last.leaves += 1;
    }

    if (separator !== null && LIST_ENDS.has(separator)) {
      listStarts[listStarts.length - 1] = commands.length;
    }
  };

  for (const token of tokens) {
    if (token.kind === 'separator') {
      collectDraft(token.operator);
    } else if (token.kind === 'subshell') {
      collectDraft(null);

      const last = commands.at(-1);

      if (token.opens) {
        draft.enters += 1;

        listStarts.push(commands.length);
      } else {
        listStarts.pop();

        if (last !== undefined) {
          last.leaves += 1;
        }
      }
    } else if (token.kind === 'heredoc') {
      // A here document's body belongs to the command whose `<<` asked for it, which a pipe may
      // already have closed.
      const owner = heredocOwners.shift();

      if (owner !== undefined) {
        owner.stdin = token.body;
      }
    } else if (token.kind === 'redirect') {
      operator = token.operator;

      if (operator === '<<' || operator === '<<-') {
        heredocOwners.push(draft);
      }
    } else if (token.kind === 'word') {
      if (operator === null) {
        draft.words.push(token.word);
      } else {
        draft.redirects.push({ operator, target: token.word });

        operator = null;
      }
    } else {
      assertNever(token);
    }
  }

  collectDraft(null);

  return commands;
}

const LIST_ENDS = new Set(['&', ';', ';;', '\n']);

function buildCommandDraft(): CommandDraft {
  return { words: [], redirects: [], stdin: null, enters: 0, leaves: 0 };
}

// The synced hook runs without npm dependencies, so a `never` check stands in for ts-pattern's
// exhaustive match: a new token kind fails the type check here.
function assertNever(token: never): never {
  throw new Error(`skill-gate: unknown shell token ${JSON.stringify(token)}`);
}
