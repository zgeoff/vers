import { expect, test } from 'bun:test';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { attachAuthHeaders } from './attach-auth-headers';

test('it builds bearer and session-id headers from a live cookie session', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: 'access-1', sessionID: 'session-1' } } },
    () => attachAuthHeaders(),
  );

  expect(outcome.value).toStrictEqual({
    authorization: 'Bearer access-1',
    'x-session-id': 'session-1',
  });
});

test('it returns no headers when there is no cookie session', async () => {
  const outcome = await withRequestContext({}, () => attachAuthHeaders());

  expect(outcome.value).toStrictEqual({});
});
