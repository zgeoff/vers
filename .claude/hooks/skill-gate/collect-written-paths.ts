import path from 'node:path';
import { parseShellCommands } from './parse-shell-commands.ts';
import type { ShellCommand, ShellWord, WrittenPath } from './types.ts';

// Collects the paths a Bash command writes through a redirect, `tee`, `sed -i`, `perl -i`, `cp`,
// `mv`, `bash -c` or an inline script. A path built from a variable or a glob is left out, and a
// command that does not parse writes nothing: the gate guides an agent and is not a sandbox.
export function collectWrittenPaths(command: string): readonly WrittenPath[] {
  return collectTextPaths(command, '');
}

// `dir` is the working directory relative to the command's start, or null after a `cd` the parser
// cannot follow, which leaves only absolute paths.
function collectTextPaths(text: string, dir: string | null): WrittenPath[] {
  const commands = parseShellCommands(text) ?? [];
  const paths: WrittenPath[] = [];
  const parentDirs: (string | null)[] = [];
  let current = dir;

  for (const command of commands) {
    const enteredFrom = current;

    parentDirs.push(...Array.from({ length: command.enters }, () => enteredFrom));
    paths.push(...collectCommandPaths(command, current));

    current = resolveNextDir(command, current);

    // Leaving a subshell drops its `cd`, so the parent's directory comes back.
    for (let left = 0; left < command.leaves && parentDirs.length > 0; left += 1) {
      current = parentDirs.pop() ?? null;
    }
  }

  return paths;
}

function collectCommandPaths(command: ShellCommand, dir: string | null): WrittenPath[] {
  const redirected = command.redirects
    .filter((redirect) => isWriteRedirect(redirect.operator, redirect.target))
    .flatMap((redirect) => resolveWordPath(redirect.target, dir));

  const words = getProgramWords(command.words);
  const [program] = words;

  if (program === undefined || !program.literal) {
    return redirected;
  }

  const name = path.basename(program.text);
  const args = words.slice(1);

  return [...redirected, ...collectProgramPaths(name, args, command.stdin, dir)];
}

const WRITE_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>']);

// `>&` sends output to a file unless its target is a file descriptor, as in `2>&1`.
function isWriteRedirect(operator: string, target: ShellWord): boolean {
  return WRITE_REDIRECTS.has(operator) || (operator === '>&' && !/^(?:\d+|-)$/u.test(target.text));
}

function resolveWordPath(word: ShellWord | undefined, dir: string | null): WrittenPath[] {
  if (word === undefined || !word.literal || word.text === '' || word.text === '-') {
    return [];
  }

  if (path.isAbsolute(word.text)) {
    return [{ path: word.text }];
  }

  return dir === null ? [] : [{ path: path.join(dir, word.text) }];
}

const ASSIGNMENT = /^[A-Za-z_]\w*=/u;

// Each wrapper names the options that take the next argument as their value, such as `sudo -u`.
const WRAPPER_VALUE_OPTIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['sudo', new Set(['-u', '-g', '-C', '-D', '-p', '-r', '-t', '-T', '-U'])],
  ['env', new Set(['-u', '-C', '-S', '--unset', '--chdir', '--split-string'])],
  ['nice', new Set(['-n', '--adjustment'])],
  ['time', new Set(['-f', '-o', '--format', '--output'])],
  ['exec', new Set(['-a'])],
  ['command', new Set<string>()],
  ['builtin', new Set<string>()],
  ['nohup', new Set<string>()],
]);

// Drops the variable assignments and wrappers such as `sudo` or `env` in front of the program.
function getProgramWords(words: readonly ShellWord[]): readonly ShellWord[] {
  let index = 0;

  while (index < words.length) {
    const word = words[index];

    if (word === undefined) {
      break;
    }

    if (ASSIGNMENT.test(word.text)) {
      index += 1;
    } else if (word.literal && WRAPPER_VALUE_OPTIONS.has(word.text)) {
      const valueOptions = WRAPPER_VALUE_OPTIONS.get(word.text) ?? new Set<string>();

      index += 1;

      while (words[index]?.text.startsWith('-') === true) {
        index += valueOptions.has(words[index]?.text ?? '') ? 2 : 1;
      }
    } else {
      break;
    }
  }

  return words.slice(index);
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const INTERPRETERS = new Set(['python', 'python3', 'node', 'bun', 'deno', 'ruby']);

// Python, Ruby and Perl start a comment with `#`, where JavaScript has `//`, and Python's `//` is
// floor division.
const JS_RUNTIMES = new Set(['node', 'bun', 'deno']);

function collectProgramPaths(
  name: string,
  args: readonly ShellWord[],
  stdin: string | null,
  dir: string | null,
): WrittenPath[] {
  if (name === 'sed' || name === 'gsed') {
    return collectInPlacePaths(args, SED_SCRIPT_FLAGS).flatMap((word) =>
      resolveWordPath(word, dir),
    );
  }

  if (name === 'perl') {
    return collectPerlPaths(args, stdin, dir);
  }

  if (name === 'tee') {
    return collectOperands(args).flatMap((word) => resolveWordPath(word, dir));
  }

  if (name === 'cp' || name === 'mv') {
    return collectCopyPaths(args, dir);
  }

  if (SHELLS.has(name)) {
    const script = findShellScript(args, stdin);

    return script === null ? [] : collectTextPaths(script, dir);
  }

  if (INTERPRETERS.has(name)) {
    const script = findInlineScript(args, stdin);
    const commentStart = JS_RUNTIMES.has(name) ? '//' : '#';

    return script === null ? [] : collectScriptPaths(script, commentStart, dir);
  }

  return [];
}

const SED_SCRIPT_FLAGS = new Set(['e', 'f']);

// Collects the files that `sed -i` or `perl -i` rewrites: every operand after the script, or every
// operand when an `-e` or `-f` flag gives the script. Without `-i` (or `--in-place`), it writes
// nothing.
function collectInPlacePaths(
  args: readonly ShellWord[],
  scriptFlags: ReadonlySet<string>,
): readonly ShellWord[] {
  let inPlace = false;
  let hasScriptFlag = false;
  let optionsEnded = false;
  const operands: ShellWord[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      break;
    }

    if (optionsEnded || !arg.text.startsWith('-') || arg.text === '-') {
      operands.push(arg);
    } else if (arg.text === '--') {
      optionsEnded = true;
    } else if (arg.text.startsWith('--')) {
      inPlace ||= arg.text === '--in-place' || arg.text.startsWith('--in-place=');

      if (/^--(?:expression|file)(?:=|$)/u.test(arg.text)) {
        hasScriptFlag = true;
        index += arg.text.includes('=') ? 0 : 1;
      }
    } else {
      const flags = parseShortFlags(arg.text, scriptFlags);

      inPlace ||= flags.inPlace;
      hasScriptFlag ||= flags.script;
      index += flags.takesNext ? 1 : 0;
    }
  }

  if (!inPlace) {
    return [];
  }

  return hasScriptFlag ? operands : operands.slice(1);
}

// Reads a bundle of short flags such as `-ni` or `-pi.bak`. An `i` takes the rest of the bundle as
// its backup suffix. A script flag takes the rest as its value, or the next argument when it ends
// the bundle.
function parseShortFlags(
  bundle: string,
  scriptFlags: ReadonlySet<string>,
): { readonly inPlace: boolean; readonly script: boolean; readonly takesNext: boolean } {
  for (let index = 1; index < bundle.length; index += 1) {
    const flag = bundle.charAt(index);

    if (flag === 'i') {
      return { inPlace: true, script: false, takesNext: false };
    }

    if (scriptFlags.has(flag)) {
      return { inPlace: false, script: true, takesNext: index === bundle.length - 1 };
    }
  }

  return { inPlace: false, script: false, takesNext: false };
}

const PERL_SCRIPT_FLAGS = new Set(['e', 'E']);

function collectPerlPaths(
  args: readonly ShellWord[],
  stdin: string | null,
  dir: string | null,
): WrittenPath[] {
  const inPlace = collectInPlacePaths(args, PERL_SCRIPT_FLAGS);

  if (inPlace.length > 0) {
    return inPlace.flatMap((word) => resolveWordPath(word, dir));
  }

  const script = findInlineScript(args, stdin);

  return script === null ? [] : collectScriptPaths(script, '#', dir);
}

function collectOperands(args: readonly ShellWord[]): readonly ShellWord[] {
  return args.filter((arg) => !arg.text.startsWith('-'));
}

// Collects where `cp` or `mv` writes: into the `-t` directory, into the destination when several
// sources or a trailing slash make it a directory, and otherwise onto the destination, or into it
// when it turns out to be a directory.
function collectCopyPaths(args: readonly ShellWord[], dir: string | null): WrittenPath[] {
  const operands: ShellWord[] = [];
  let targetDir: ShellWord | undefined;
  let optionsEnded = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      break;
    }

    if (optionsEnded || !arg.text.startsWith('-') || arg.text === '-') {
      operands.push(arg);
    } else if (arg.text === '--') {
      optionsEnded = true;
    } else if (arg.text.startsWith('--target-directory=')) {
      targetDir = { ...arg, text: arg.text.slice('--target-directory='.length) };
    } else if (arg.text === '--target-directory' || /^-[^-]*t$/u.test(arg.text)) {
      targetDir = args[index + 1];
      index += 1;
    } else if (arg.text === '-S' || arg.text === '--suffix') {
      index += 1;
    }
  }

  if (targetDir !== undefined) {
    return collectIntoDirPaths(targetDir, operands, dir);
  }

  const destination = operands.at(-1);
  const sources = operands.slice(0, -1);
  const [source] = sources;

  if (destination === undefined || source === undefined) {
    return [];
  }

  if (sources.length > 1 || destination.text.endsWith('/')) {
    return collectIntoDirPaths(destination, sources, dir);
  }

  const fileName = source.literal ? path.basename(source.text) : undefined;

  return resolveWordPath(destination, dir).map((written) =>
    fileName === undefined ? written : { path: written.path, fileName },
  );
}

function collectIntoDirPaths(
  target: ShellWord,
  sources: readonly ShellWord[],
  dir: string | null,
): WrittenPath[] {
  return resolveWordPath(target, dir).flatMap((written) =>
    sources
      .filter((source) => source.literal)
      .map((source) => ({ path: path.join(written.path, path.basename(source.text)) })),
  );
}

// Finds the script a shell runs: the operand after `-c`, or the here document when the shell has
// no script file.
function findShellScript(args: readonly ShellWord[], stdin: string | null): string | null {
  const hasCommandFlag = args.some((arg) => /^-[A-Za-z]*c[A-Za-z]*$/u.test(arg.text));
  const [script] = collectOperands(args);

  if (hasCommandFlag) {
    return script?.literal === true ? script.text : null;
  }

  return script === undefined ? stdin : null;
}

const INLINE_FLAGS = new Set(['-c', '-e', '-E', '--eval', '-p', '--print', 'eval']);

// Finds the code an interpreter runs from its arguments, as in `python3 -c`, `node -e` or
// `deno eval`, or from a here document when it reads its script from stdin.
function findInlineScript(args: readonly ShellWord[], stdin: string | null): string | null {
  const flagIndex = args.findIndex((arg) => INLINE_FLAGS.has(arg.text));
  const code = flagIndex === -1 ? undefined : args[flagIndex + 1];

  if (code !== undefined) {
    return code.literal ? code.text : null;
  }

  const readsStdin = args.length === 0 || args.some((arg) => arg.text === '-');

  return readsStdin ? stdin : null;
}

// Each pattern names the quoted path that a common file-writing call in a script takes.
const SCRIPT_WRITE_PATTERNS = [
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\(\s*(?<quote>['"`])(?<path>[^'"`]+)\k<quote>/gu,
  /\bBun\.write\(\s*(?<quote>['"`])(?<path>[^'"`]+)\k<quote>/gu,
  /\bopen\(\s*(?<quote>['"])(?<path>[^'"]+)\k<quote>\s*,\s*(?:mode\s*=\s*)?(?<modeQuote>['"])[^'"]*[wax+][^'"]*\k<modeQuote>/gu,
  /\bPath\(\s*(?<quote>['"])(?<path>[^'"]+)\k<quote>\s*\)\.write_(?:text|bytes)\(/gu,
  /\bFile\.write\(\s*(?<quote>['"])(?<path>[^'"]+)\k<quote>/gu,
  /\bopen\s*\(?\s*(?:my\s+)?\$?\w+\s*,\s*['"](?:>|>>|\+<)['"]\s*,\s*(?<quote>['"])(?<path>[^'"]+)\k<quote>/gu,
];

function collectScriptPaths(
  script: string,
  commentStart: string,
  dir: string | null,
): WrittenPath[] {
  const textRanges = collectScriptTextRanges(script, commentStart);

  return SCRIPT_WRITE_PATTERNS.flatMap((pattern) =>
    [...script.matchAll(pattern)].flatMap((match) => {
      const written = match.groups?.['path'] ?? '';

      const isText = textRanges.some(
        (range) => match.index > range.start && match.index < range.end,
      );

      return isText || /[$*?{]/u.test(written)
        ? []
        : resolveWordPath({ text: written, literal: true }, dir);
    }),
  );
}

// Collects the spans of a script's string literals and comments, so a write call that only appears
// in text, such as `print("open('a.ts', 'w')")`, is not read as code.
function collectScriptTextRanges(
  script: string,
  commentStart: string,
): readonly { readonly start: number; readonly end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let index = 0;

  while (index < script.length) {
    const char = script.charAt(index);

    if (commentStart === '//' && script.startsWith('/*', index)) {
      const close = script.indexOf('*/', index + 2);
      const end = close === -1 ? script.length : close + 2;

      ranges.push({ start: index, end });

      index = end;
    } else if (script.startsWith(commentStart, index)) {
      const newline = script.indexOf('\n', index);
      const end = newline === -1 ? script.length : newline;

      ranges.push({ start: index, end });

      index = end;
    } else if (char === "'" || char === '"' || char === '`') {
      const end = getQuoteEndOrScriptEnd(script, index);

      ranges.push({ start: index, end });

      index = end;
    } else {
      index += 1;
    }
  }

  return ranges;
}

function getQuoteEndOrScriptEnd(script: string, start: number): number {
  const quote = script.charAt(start);
  let index = start + 1;

  while (index < script.length && script.charAt(index) !== quote) {
    index += script.charAt(index) === '\\' ? 2 : 1;
  }

  return Math.min(index + 1, script.length);
}

function resolveNextDir(command: ShellCommand, dir: string | null): string | null {
  const [program, ...args] = command.words;

  if (program?.text !== 'cd') {
    return dir;
  }

  const [target] = collectOperands(args);

  if (target === undefined || !target.literal) {
    return null;
  }

  if (path.isAbsolute(target.text)) {
    return target.text;
  }

  return dir === null ? null : path.join(dir, target.text);
}
