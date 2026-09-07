import { expect, test } from 'bun:test';
import { buildTargetSocketURL } from './build-target-socket-url';

test('it points the reported socket url at the endpoint the caller reaches', () => {
  const url = buildTargetSocketURL(
    {
      id: 'ABC123',
      title: 'vers',
      type: 'shared_worker',
      url: 'https://versidle.com/worker.js',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/ABC123',
    },
    '172.28.80.1:9223',
  );

  expect(url).toBe('ws://172.28.80.1:9223/devtools/page/ABC123');
});

test('it builds the page socket url when the target reports none', () => {
  const url = buildTargetSocketURL(
    { id: 'ABC123', title: 'vers', type: 'page', url: 'https://versidle.com/' },
    '127.0.0.1:9222',
  );

  expect(url).toBe('ws://127.0.0.1:9222/devtools/page/ABC123');
});
