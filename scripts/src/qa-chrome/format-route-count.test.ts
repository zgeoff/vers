import { expect, test } from 'bun:test';
import { formatRouteCount } from './format-route-count';

test.each([
  [0, '0 routes'],
  [1, '1 route'],
  [5, '5 routes'],
])('it counts %d as %s', (count, expected) => {
  expect(formatRouteCount(count)).toBe(expected);
});
