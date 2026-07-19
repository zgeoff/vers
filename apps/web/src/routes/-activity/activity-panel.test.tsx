import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityPanel } from './activity-panel';

test('it renders the engagement title with no catching-up indicator by default', () => {
  const rendered = render(<ActivityPanel />);

  expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
  expect(rendered.queryByTestId('catching-up-indicator')).not.toBeInTheDocument();
});

test('it shows exactly one catching-up indicator while appended progress is still settling', async () => {
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
      expect(rendered.getAllByTestId('catching-up-indicator')).toHaveLength(1);
    });

    expect(rendered.getByTestId('catching-up-indicator')).toHaveTextContent(
      'Catching up — 1 reward settling',
    );
  });
});

test('it pluralizes the catching-up notice when several rewards are settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    await waitFor(() => {
      expect(rendered.getByTestId('catching-up-indicator')).toHaveTextContent(
        'Catching up — 3 rewards settling',
      );
    });
  });
});

test('it shows no catching-up indicator once the appended progress is fully verified', async () => {
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

    expect(rendered.queryByTestId('catching-up-indicator')).not.toBeInTheDocument();
  });
});
