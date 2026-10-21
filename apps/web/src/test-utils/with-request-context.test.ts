import { expect, test } from 'bun:test';
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server';
import { unsealData } from 'iron-session';
import { readSessionSecret } from '../lib/auth/read-session-secret';
import { withRequestContext } from './with-request-context';

test('it seals each input cookie with the session secret', async () => {
  const outcome = await withRequestContext({ cookies: { en_session: { sessionID: 's-1' } } }, () =>
    unsealData(getCookie('en_session') ?? '', { password: readSessionSecret() }),
  );

  expect(outcome.value).toStrictEqual({ sessionID: 's-1' });
});

test('it reports an input cookie that the run left alone as its unsealed data', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { sessionID: 's-1' } } },
    () => {},
  );

  expect(outcome.cookies).toStrictEqual({ en_session: { sessionID: 's-1' } });
});

test('it leaves a cookie that the run deleted out of the reported cookies', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { sessionID: 's-1' } } },
    () => {
      deleteCookie('en_session');
    },
  );

  expect(outcome.cookies).toStrictEqual({});
});

test('it records the options of each cookie that the run set', async () => {
  const outcome = await withRequestContext({}, () => {
    setCookie('en_theme', 'dusk', { httpOnly: true, maxAge: 120 });
  });

  expect(outcome.setCookies.get('en_theme')).toStrictEqual({
    options: { httpOnly: true, maxAge: 120 },
    value: 'dusk',
  });
});

test('it keeps reading the request cookie after the run sets a new value, as Start does', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_session: { sessionID: 's-1' } } },
    () => {
      setCookie('en_session', 'replaced');

      return unsealData(getCookie('en_session') ?? '', { password: readSessionSecret() });
    },
  );

  expect(outcome.value).toStrictEqual({ sessionID: 's-1' });
});
