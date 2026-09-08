import { expect, test } from 'bun:test';
import { pickColdPathVerdict } from './pick-cold-path-verdict';

test('it reports an idle fleet when no request arrived', () => {
  expect(pickColdPathVerdict([])).toStrictEqual({ kind: 'idle' });
});

test('it reports the request count with the busiest routes first', () => {
  const verdict = pickColdPathVerdict([
    { route: 'GET /', traceID: 't1' },
    { route: 'POST /api/rpc/activity/advanceActivity', traceID: 't2' },
    { route: 'POST /api/rpc/activity/advanceActivity', traceID: 't3' },
    { route: 'GET /explore', traceID: 't4' },
  ]);

  expect(verdict).toStrictEqual({
    count: 4,
    kind: 'active',
    routes: [
      { count: 2, route: 'POST /api/rpc/activity/advanceActivity' },
      { count: 1, route: 'GET /' },
      { count: 1, route: 'GET /explore' },
    ],
  });
});

test('it lists at most five routes', () => {
  const verdict = pickColdPathVerdict(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((route) => ({ route, traceID: route })),
  );

  expect(verdict).toStrictEqual({
    count: 7,
    kind: 'active',
    routes: [
      { count: 1, route: 'a' },
      { count: 1, route: 'b' },
      { count: 1, route: 'c' },
      { count: 1, route: 'd' },
      { count: 1, route: 'e' },
    ],
  });
});
