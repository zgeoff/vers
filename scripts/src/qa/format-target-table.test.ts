import { expect, test } from 'bun:test';
import { formatTargetTable } from './format-target-table';

test('it aligns one line per target with the title last', () => {
  const table = formatTargetTable([
    { id: 'A1', title: 'vers', type: 'page', url: 'https://versidle.com/' },
    {
      id: 'B22',
      title: '',
      type: 'shared_worker',
      url: 'https://versidle.com/worker.js',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/B22',
    },
  ]);

  expect(table).toBe(
    [
      'page           A1   https://versidle.com/           vers',
      'shared_worker  B22  https://versidle.com/worker.js',
    ].join('\n'),
  );
});

test('it renders nothing for no targets', () => {
  expect(formatTargetTable([])).toBe('');
});
