import { expect, test } from 'bun:test';
import { findSectionStub } from './find-section-stub';

const TEMPLATE = [
  '---',
  'name: Bug',
  '---',
  '',
  '## Observed',
  '',
  '<!-- what actually happens -->',
  '',
  '## Repro',
  '',
  '<!-- numbered steps -->',
  '',
].join('\n');

test('it extracts a section up to the next heading, trimming trailing blank lines', () => {
  expect(findSectionStub(TEMPLATE, 'Observed')).toBe(
    '## Observed\n\n<!-- what actually happens -->',
  );
});

test('it extracts the final section through end of file', () => {
  expect(findSectionStub(TEMPLATE, 'Repro')).toBe('## Repro\n\n<!-- numbered steps -->');
});

test('it returns null when the template has no such heading', () => {
  expect(findSectionStub(TEMPLATE, 'Expected')).toBeNull();
});
