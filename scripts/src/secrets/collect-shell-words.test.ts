import { expect, test } from 'bun:test';
import { collectShellWords } from './collect-shell-words';

test.each([
  ['spaces', 'op read token', ['op', 'read', 'token']],
  ['a semicolon', 'deploy;verify', ['deploy', 'verify']],
  ['an and-list', 'deploy && verify', ['deploy', 'verify']],
  ['a pipe', 'deploy|verify', ['deploy', 'verify']],
  ['a newline', 'deploy\nverify', ['deploy', 'verify']],
  ['a subshell', '(deploy)', ['deploy']],
])('it splits words at %s', (_boundary, text, values) => {
  expect(collectShellWords(text).map((word) => word.value)).toStrictEqual(values);
});

test.each([
  ['single quotes', `'a b;c'`, 'a b;c'],
  ['double quotes', `"a b;c"`, 'a b;c'],
  ['ANSI-C quotes', `$'a b;c'`, 'a b;c'],
  ['an escaped space', String.raw`a\ b`, 'a b'],
  ['glued quoted fragments', `'a'"b"c`, 'abc'],
  ['an escaped quote in double quotes', String.raw`"say \"hi\""`, 'say "hi"'],
  ['an escaped quote in ANSI-C quotes', String.raw`$'it\'s'`, "it's"],
  ['a kept backslash in double quotes', String.raw`"a\b"`, String.raw`a\b`],
])('it reads %s as one word', (_form, text, value) => {
  expect(collectShellWords(text)).toStrictEqual([{ isComplete: true, value }]);
});

test.each([
  ['2>/dev/null', 'run 2>/dev/null', ['run', '/dev/null']],
  ['2>&1', 'run 2>&1', ['run']],
  ['>&2', 'run >&2', ['run']],
  ['<<', 'cat <<END', ['cat', 'END']],
  ['a quoted digit', `run '2'>out`, ['run', '2', 'out']],
])('it drops the %s redirection operator and descriptor', (_redirection, text, values) => {
  expect(collectShellWords(text).map((word) => word.value)).toStrictEqual(values);
});

test.each([
  ['a dollar substitution', `TOKEN="$(op read 'a')" run`, ['op', 'read', 'a', 'TOKEN=$', 'run']],
  ['a backtick substitution', 'echo `date`', ['echo', 'date', '$']],
  ['a variable', 'echo "$HOME/bin"', ['echo', '$HOME/bin']],
])('it collects the words of %s beside the marked outer word', (_form, text, values) => {
  expect(collectShellWords(text).map((word) => word.value)).toStrictEqual(values);
});

test('it skips a comment that starts a word', () => {
  expect(collectShellWords('run # not a word\nverify#kept')).toStrictEqual([
    { isComplete: true, value: 'run' },
    { isComplete: true, value: 'verify#kept' },
  ]);
});

test('it marks a word whose quote never closes on its line as incomplete', () => {
  expect(collectShellWords(`run 'open\nverify`)).toStrictEqual([
    { isComplete: true, value: 'run' },
    { isComplete: false, value: 'open' },
    { isComplete: true, value: 'verify' },
  ]);
});
