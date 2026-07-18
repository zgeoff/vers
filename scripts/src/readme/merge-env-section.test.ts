import { expect, test } from 'bun:test';
import { mergeEnvSection } from './merge-env-section';

test('it replaces the content between the markers and nothing else', () => {
  const readme = [
    '# @vers/service-user',
    '',
    '<!-- env:begin -->',
    'old table',
    '<!-- env:end -->',
    '',
    'trailer',
  ].join('\n');

  expect(mergeEnvSection(readme, '| new |')).toBe(
    [
      '# @vers/service-user',
      '',
      '<!-- env:begin -->',
      '',
      '| new |',
      '',
      '<!-- env:end -->',
      '',
      'trailer',
    ].join('\n'),
  );
});

test('it leaves an already-current README byte-identical', () => {
  const readme = ['<!-- env:begin -->', '', '| t |', '', '<!-- env:end -->'].join('\n');

  expect(mergeEnvSection(readme, '| t |')).toBe(readme);
});

test('it rejects a README without env markers', () => {
  expect(() => mergeEnvSection('# bare readme', '| t |')).toThrow('missing env markers');
});
