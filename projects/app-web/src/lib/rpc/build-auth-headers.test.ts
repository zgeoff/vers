import { expect, test } from 'bun:test';
import { buildAuthHeaders } from './build-auth-headers';

test('it builds bearer and session-id headers from a live session', () => {
  expect(buildAuthHeaders({ accessToken: 'access-1', sessionID: 'session-1' })).toStrictEqual({
    authorization: 'Bearer access-1',
    'x-session-id': 'session-1',
  });
});

test('it returns no headers for a session that is not live', () => {
  expect(buildAuthHeaders({})).toStrictEqual({});
});
