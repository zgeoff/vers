import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAvatarContent } from './get-avatar-content';

test('it redirects to avatar creation when the caller has no avatar yet', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    getAvatarContent()
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.value).toBe('/avatar/create');
});
