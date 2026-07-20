import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityPanel } from './activity-panel';

test('it renders the engagement title with no settling indicator by default', () => {
  const rendered = render(<ActivityPanel />);

  expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
  expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
});

test('it shows the settling indicator while appended progress is still settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    await waitFor(() => {
      expect(rendered.getAllByTestId('settling-indicator')).toHaveLength(1);
    });
  });
});

test('it shows no settling indicator once the appended progress is fully verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 2,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    await waitFor(() => {
      expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
    });

    expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
  });
});
