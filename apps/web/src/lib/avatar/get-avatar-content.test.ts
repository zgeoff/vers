import { expect, test } from 'bun:test';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAvatarContent } from './get-avatar-content';

test('it throws when a shell route loads without an active avatar', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    getAvatarContent()
      .then(() => null)
      .catch((error: unknown) => (error instanceof Error ? error.message : null)),
  );

  expect(outcome.value).toContain('active avatar');
});
