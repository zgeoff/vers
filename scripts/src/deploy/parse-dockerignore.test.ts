import { expect, test } from 'bun:test';
import { parseDockerignore } from './parse-dockerignore';

test('it reads one pattern per line and skips blanks and comments', () => {
  const text = '# compiled output\n\ndist\n  node_modules  \n';

  expect(parseDockerignore(text)).toStrictEqual([
    { glob: 'dist', negated: false },
    { glob: 'node_modules', negated: false },
  ]);
});

test('it marks a bang-prefixed line as a negation and anchors its pattern too', () => {
  expect(parseDockerignore('.vscode/*\n!.vscode/settings.json\n!/dist/keep/')).toStrictEqual([
    { glob: '.vscode/*', negated: false },
    { glob: '.vscode/settings.json', negated: true },
    { glob: 'dist/keep', negated: true },
  ]);
});

test('it anchors a leading slash, a dot-slash prefix, and a trailing slash at the root', () => {
  expect(parseDockerignore('/.idea\n./out\n.settings/')).toStrictEqual([
    { glob: '.idea', negated: false },
    { glob: 'out', negated: false },
    { glob: '.settings', negated: false },
  ]);
});

test('it cleans dot-dot and doubled separators the way docker does', () => {
  expect(parseDockerignore('foo/../bar\na//b\n')).toStrictEqual([
    { glob: 'bar', negated: false },
    { glob: 'a/b', negated: false },
  ]);
});

test('it drops a bare dot pattern', () => {
  expect(parseDockerignore('.\n**/*.md')).toStrictEqual([{ glob: '**/*.md', negated: false }]);
});
