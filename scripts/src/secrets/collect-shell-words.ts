import { match } from 'ts-pattern';
import type { ShellWord } from './types';

export function collectShellWords(text: string): Array<ShellWord> {
  const words: Array<ShellWord> = [];

  scanCommand(text, 0, undefined, words);

  return words;
}

type ScanState =
  | 'ansi'
  | 'ansi-escape'
  | 'blank'
  | 'comment'
  | 'double'
  | 'double-escape'
  | 'escape'
  | 'redirection'
  | 'single'
  | 'word';

interface ScanContext {
  readonly closer: string | undefined;
  readonly text: string;
  readonly words: Array<ShellWord>;
  index: number;
  isComplete: boolean;
  isOpen: boolean;
  isQuoted: boolean;
  state: ScanState;
  value: string;
}

function scanCommand(
  text: string,
  start: number,
  closer: string | undefined,
  words: Array<ShellWord>,
): number {
  const ctx: ScanContext = {
    closer,
    index: start,
    isComplete: true,
    isOpen: false,
    isQuoted: false,
    state: 'blank',
    text,
    value: '',
    words,
  };

  while (ctx.index < text.length) {
    if (isAtCloser(ctx)) {
      endWord(ctx);

      return ctx.index + 1;
    }

    scanCharacter(ctx, text.charAt(ctx.index));
  }

  if (isInsideQuote(ctx.state)) {
    ctx.isComplete = false;
  }

  endWord(ctx);

  return text.length;
}

function isAtCloser(ctx: ScanContext): boolean {
  return (
    ctx.closer !== undefined &&
    ctx.text.charAt(ctx.index) === ctx.closer &&
    (ctx.state === 'blank' || ctx.state === 'word' || ctx.state === 'redirection')
  );
}

function endWord(ctx: ScanContext): void {
  if (ctx.isOpen) {
    ctx.words.push({ isComplete: ctx.isComplete, value: ctx.value });
  }

  dropWord(ctx);
}

function dropWord(ctx: ScanContext): void {
  ctx.isComplete = true;
  ctx.isOpen = false;
  ctx.isQuoted = false;
  ctx.value = '';
}

// an expansion's value is unknown until the shell runs, so a word that holds one keeps this mark
const EXPANSION_MARK = '$';

function scanCharacter(ctx: ScanContext, char: string): void {
  match(ctx.state)
    .with('blank', () => {
      scanBlank(ctx, char);
    })
    .with('word', () => {
      scanWord(ctx, char);
    })
    .with('single', () => {
      scanQuoted(ctx, char, "'");
    })
    .with('ansi', () => {
      scanQuoted(ctx, char, "'");
    })
    .with('double', () => {
      scanDouble(ctx, char);
    })
    .with('escape', () => {
      if (char !== '\n') {
        ctx.value += char;
      }

      ctx.state = 'word';
      ctx.index += 1;
    })
    .with('double-escape', () => {
      ctx.value += '$`"\\\n'.includes(char) ? char.replace('\n', '') : `\\${char}`;
      ctx.state = 'double';
      ctx.index += 1;
    })
    .with('ansi-escape', () => {
      ctx.value += `'"\\?`.includes(char) ? char : EXPANSION_MARK;
      ctx.state = 'ansi';
      ctx.index += 1;
    })
    .with('comment', () => {
      ctx.state = char === '\n' ? 'blank' : 'comment';
      ctx.index += 1;
    })
    .with('redirection', () => {
      if (/[\d&<>|-]/u.test(char)) {
        ctx.index += 1;
      } else {
        ctx.state = 'blank';
      }
    })
    .exhaustive();
}

function scanBlank(ctx: ScanContext, char: string): void {
  if (/\s/u.test(char) || ';&|()'.includes(char)) {
    ctx.index += 1;
  } else if (char === '#') {
    ctx.state = 'comment';
    ctx.index += 1;
  } else if (char === '<' || char === '>') {
    ctx.state = 'redirection';
    ctx.index += 1;
  } else {
    ctx.isOpen = true;
    ctx.state = 'word';
  }
}

function scanWord(ctx: ScanContext, char: string): void {
  if (/\s/u.test(char) || ';&|()'.includes(char)) {
    endWord(ctx);

    ctx.state = 'blank';
  } else if (char === '<' || char === '>') {
    // a run of digits glued to a redirection is its file descriptor, never a word of the command
    if (!ctx.isQuoted && /^\d+$/u.test(ctx.value)) {
      dropWord(ctx);
    }

    endWord(ctx);

    ctx.state = 'redirection';
    ctx.index += 1;
  } else if (char === "'" || char === '"') {
    ctx.isQuoted = true;
    ctx.state = char === "'" ? 'single' : 'double';
    ctx.index += 1;
  } else if (char === '\\') {
    ctx.state = 'escape';
    ctx.index += 1;
  } else if (char === '$' && ctx.text.charAt(ctx.index + 1) === "'") {
    ctx.isQuoted = true;
    ctx.state = 'ansi';
    ctx.index += 2;
  } else if (isExpansionStart(char)) {
    scanExpansion(ctx, char);
  } else {
    ctx.value += char;
    ctx.index += 1;
  }
}

function isExpansionStart(char: string): boolean {
  return char === '$' || char === '`';
}

// a command substitution is a command line of its own, so its words are collected beside the
// outer word, which holds only the expansion mark in its place
function scanExpansion(ctx: ScanContext, char: string): void {
  ctx.value += EXPANSION_MARK;

  if (char === '`') {
    ctx.index = scanCommand(ctx.text, ctx.index + 1, '`', ctx.words);
  } else if (ctx.text.charAt(ctx.index + 1) === '(') {
    ctx.index = scanCommand(ctx.text, ctx.index + 2, ')', ctx.words);
  } else {
    ctx.index += 1;
  }
}

function scanQuoted(ctx: ScanContext, char: string, quote: string): void {
  if (char === quote) {
    ctx.state = 'word';
  } else if (char === '\n') {
    ctx.isComplete = false;

    endWord(ctx);

    ctx.state = 'blank';
  } else if (char === '\\' && ctx.state === 'ansi') {
    ctx.state = 'ansi-escape';
  } else {
    ctx.value += char;
  }

  ctx.index += 1;
}

function scanDouble(ctx: ScanContext, char: string): void {
  if (char === '"') {
    ctx.state = 'word';
    ctx.index += 1;
  } else if (char === '\\') {
    ctx.state = 'double-escape';
    ctx.index += 1;
  } else if (char === '\n') {
    ctx.isComplete = false;

    endWord(ctx);

    ctx.state = 'blank';
    ctx.index += 1;
  } else if (isExpansionStart(char)) {
    scanExpansion(ctx, char);
  } else {
    ctx.value += char;
    ctx.index += 1;
  }
}

function isInsideQuote(state: ScanState): boolean {
  return (
    state === 'ansi' ||
    state === 'ansi-escape' ||
    state === 'double' ||
    state === 'double-escape' ||
    state === 'single'
  );
}
