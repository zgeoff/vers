import { expect, onTestFinished, setSystemTime, test } from 'bun:test';
import { unsealData } from 'iron-session';
import invariant from 'tiny-invariant';
import { withRequestContext } from '../../test-utils/with-request-context';
import { readSessionSecret } from './read-session-secret';
import { readVerifySession } from './read-verify-session';
import { updateVerifySession } from './update-verify-session';
import { VERIFY_SESSION_KEYS } from './verify-session-keys';

test('it merges the update into the verification data already in the cookie', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_verification: { [VERIFY_SESSION_KEYS.loginLogout.email]: 'pilot@example.test' },
      },
    },
    () => updateVerifySession({ [VERIFY_SESSION_KEYS.onboarding.email]: 'cadet@example.test' }),
  );

  expect(outcome.cookies['en_verification']).toStrictEqual({
    [VERIFY_SESSION_KEYS.loginLogout.email]: 'pilot@example.test',
    [VERIFY_SESSION_KEYS.onboarding.email]: 'cadet@example.test',
  });
});

test('it splits a redirect too long for one cookie across several cookies', async () => {
  const redirect = `/respite?filter=${'x'.repeat(3000)}`;

  const outcome = await withRequestContext({}, async () => {
    await updateVerifySession({ [VERIFY_SESSION_KEYS.loginLogout.redirect]: redirect });

    return readVerifySession();
  });

  expect(outcome.value).toStrictEqual({ [VERIFY_SESSION_KEYS.loginLogout.redirect]: redirect });

  expect(outcome.cookies).toStrictEqual({
    en_verification: { [VERIFY_SESSION_KEYS.loginLogout.redirect]: redirect },
  });

  expect([...outcome.setCookies.keys()]).toIncludeAllMembers([
    'en_verification.0',
    'en_verification.1',
  ]);
});

test('it drops a key that the update sets to undefined', async () => {
  const outcome = await withRequestContext(
    {
      cookies: {
        en_verification: { [VERIFY_SESSION_KEYS.onboarding.email]: 'cadet@example.test' },
      },
    },
    () => updateVerifySession({ [VERIFY_SESSION_KEYS.onboarding.email]: undefined }),
  );

  expect(outcome.value).toStrictEqual({});
});

test('it sets the verification cookie to outlive no more than its 10 minute seal', async () => {
  const outcome = await withRequestContext({}, () =>
    updateVerifySession({ [VERIFY_SESSION_KEYS.onboarding.email]: 'cadet@example.test' }),
  );

  // iron-session sets Max-Age 60 seconds short of the seal's ttl
  expect(outcome.setCookies.get('en_verification')?.options?.maxAge).toBe(540);
});

test('it seals the verification cookie so it no longer opens after 10 minutes', async () => {
  const outcome = await withRequestContext({}, () =>
    updateVerifySession({ [VERIFY_SESSION_KEYS.onboarding.email]: 'cadet@example.test' }),
  );

  const sealed = outcome.setCookies.get('en_verification');

  invariant(sealed);
  onTestFinished(() => setSystemTime());
  setSystemTime(new Date(Date.now() + 11 * 60 * 1000));

  expect(unsealData(sealed.value, { password: readSessionSecret() })).resolves.toStrictEqual({});
});
