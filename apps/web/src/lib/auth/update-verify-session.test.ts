import { expect, onTestFinished, setSystemTime, test } from 'bun:test';
import { unsealData } from 'iron-session';
import invariant from 'tiny-invariant';
import { withRequestContext } from '../../test-utils/with-request-context';
import { readSessionSecret } from './read-session-secret';
import { updateVerifySession } from './update-verify-session';

test('it merges the update into the verification data already in the cookie', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'loginLogout#email': 'pilot@example.test' } } },
    () => updateVerifySession({ 'onboarding#email': 'cadet@example.test' }),
  );

  expect(outcome.cookies['en_verification']).toStrictEqual({
    'loginLogout#email': 'pilot@example.test',
    'onboarding#email': 'cadet@example.test',
  });
});

test('it drops a key that the update sets to undefined', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'cadet@example.test' } } },
    () => updateVerifySession({ 'onboarding#email': undefined }),
  );

  expect(outcome.value).toStrictEqual({});
});

test('it sets the verification cookie to outlive no more than its 10 minute seal', async () => {
  const outcome = await withRequestContext({}, () =>
    updateVerifySession({ 'onboarding#email': 'cadet@example.test' }),
  );

  // iron-session sets Max-Age 60 seconds short of the seal's ttl
  expect(outcome.setCookies.get('en_verification')?.options?.maxAge).toBe(540);
});

test('it seals the verification cookie so it no longer opens after 10 minutes', async () => {
  const outcome = await withRequestContext({}, () =>
    updateVerifySession({ 'onboarding#email': 'cadet@example.test' }),
  );

  const sealed = outcome.setCookies.get('en_verification');

  invariant(sealed);
  onTestFinished(() => setSystemTime());
  setSystemTime(new Date(Date.now() + 11 * 60 * 1000));

  expect(unsealData(sealed.value, { password: readSessionSecret() })).resolves.toStrictEqual({});
});
