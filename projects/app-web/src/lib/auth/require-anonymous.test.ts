import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireAnonymous } from './require-anonymous';

test('it resolves without redirecting for a signed-out caller', async () => {
  const outcome = await withRequestContext({}, () => requireAnonymous());

  expect(outcome.value).toBeUndefined();
});

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    requireAnonymous(),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});
