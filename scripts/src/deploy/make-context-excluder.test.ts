import { expect, test } from 'bun:test';
import { makeContextExcluder } from './make-context-excluder';

test('it excludes a root-level entry and everything beneath it', () => {
  const isExcluded = makeContextExcluder([{ glob: 'dist', negated: false }]);

  expect(isExcluded('dist')).toBeTrue();
  expect(isExcluded('dist/index.js')).toBeTrue();
});

test('it keeps a nested entry a root-anchored pattern does not name', () => {
  const isExcluded = makeContextExcluder([{ glob: 'dist', negated: false }]);

  expect(isExcluded('apps/web/dist/index.js')).toBeFalse();
});

test('it excludes a file at any depth under a globstar pattern', () => {
  const isExcluded = makeContextExcluder([{ glob: '**/*.md', negated: false }]);

  expect(isExcluded('README.md')).toBeTrue();
  expect(isExcluded('apps/bugsink/README.md')).toBeTrue();
  expect(isExcluded('apps/bugsink/fly.toml')).toBeFalse();
});

test('it lets the last matching pattern decide so a negation re-includes a file', () => {
  const isExcluded = makeContextExcluder([
    { glob: '.vscode/*', negated: false },
    { glob: '.vscode/settings.json', negated: true },
  ]);

  expect(isExcluded('.vscode/launch.json')).toBeTrue();
  expect(isExcluded('.vscode/settings.json')).toBeFalse();
});

test('it excludes nothing with no patterns', () => {
  const isExcluded = makeContextExcluder([]);

  expect(isExcluded('apps/bugsink/README.md')).toBeFalse();
});
