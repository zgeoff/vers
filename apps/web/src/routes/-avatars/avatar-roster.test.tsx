import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createMockAvatar } from '../../test-utils/factories/create-mock-avatar';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { writePendingStartIntentRecord } from '../../test-utils/write-pending-start-intent-record';
import { AvatarRoster } from './avatar-roster';

test('it renders each avatar as a selectable card and offers a create slot', async () => {
  const avatar = createMockAvatar({ name: 'Karnak' });

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [avatar] }} />);

  const card = await screen.findByRole('button', { name: /Karnak/ });

  expect(card).toBeEnabled();

  expect(screen.getByRole('link', { name: /Create avatar/ })).toHaveAttribute(
    'href',
    '/avatars/create',
  );
});

test('it marks the active avatar', async () => {
  const active = createMockAvatar({ name: 'Karnak' });
  const idle = createMockAvatar({ name: 'Zetha' });

  renderWithRouter(
    <AvatarRoster roster={{ activeAvatarID: active.id, avatars: [active, idle] }} />,
  );

  const activeCard = await screen.findByRole('button', { name: /Karnak/ });

  const idleCard = screen.getByRole('button', { name: /Zetha/ });

  expect(activeCard).toHaveTextContent('Active');
  expect(idleCard).not.toHaveTextContent('Active');
});

test('it shows only the create slot when the account has no avatars', async () => {
  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [] }} />);

  const createLink = await screen.findByRole('link', { name: /Create avatar/ });

  expect(createLink).toHaveAttribute('href', '/avatars/create');
  expect(screen.queryByText(/Level/)).not.toBeInTheDocument();
});

test('it hides the create slot when every mode is at its cap', async () => {
  const avatars = [
    ...Array.from({ length: AVATAR_MODE_CAP }, () => createMockAvatar({ mode: 'trade' })),
    ...Array.from({ length: AVATAR_MODE_CAP }, () => createMockAvatar({ mode: 'self_found' })),
  ];

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars }} />);

  await screen.findByRole('heading', { name: /Choose your avatar/ });

  expect(screen.queryByRole('link', { name: /Create avatar/ })).not.toBeInTheDocument();
});

test('it blocks a click on a different avatar than the one live in the simulation', async () => {
  const user = userEvent.setup();
  const out = createMockAvatar({ name: 'Karnak' });
  const other = createMockAvatar({ name: 'Zetha' });

  setIdleWorkerHandle({
    activity: undefined,
    avatar: createMockAvatarSnapshot({ id: out.id, name: out.name }),
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [out, other] }} />);

  const otherCard = await screen.findByRole('button', { name: /Zetha/ });

  await user.click(otherCard);
  await screen.findByText('Karnak is out on an activity — finish or stop it to switch');
});

test('it lets a click on the currently-out avatar proceed', async () => {
  const user = userEvent.setup();

  const signedIn = await createSignedInUser();
  const out = await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });
  const other = await db.avatarCollection.create({ name: 'Zetha', userID: signedIn.userID });

  await db.activityCollection.create({ avatarID: out.id, status: 'active' });

  setIdleWorkerHandle({
    activity: undefined,
    avatar: createMockAvatarSnapshot({ id: out.id, name: out.name }),
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [out, other] }} />);

    const outCard = await screen.findByRole('button', { name: /Karnak/ });

    await user.click(outCard);

    await waitFor(() => {
      const active = db.activeAvatarCollection.findFirst((q) =>
        q.where({ userID: signedIn.userID }),
      );

      expect(active).toMatchObject({ avatarID: out.id });
    });

    expect(screen.queryByText(/is out on an activity/)).not.toBeInTheDocument();
  });
});

test('it blocks a click on a different avatar than the one named by a parked continuation-start intent', async () => {
  const user = userEvent.setup();
  const out = createMockAvatar({ name: 'Karnak' });
  const other = createMockAvatar({ name: 'Zetha' });

  await writePendingStartIntentRecord({
    activityID: 'activity_1',
    avatarID: out.id,
    scopeID: 'scope_1',
    scopeType: 'world_map_node',
  });

  renderWithRouter(<AvatarRoster roster={{ activeAvatarID: null, avatars: [out, other] }} />);

  const otherCard = await screen.findByRole('button', { name: /Zetha/ });

  await user.click(otherCard);
  await screen.findByText('Karnak is out on an activity — finish or stop it to switch');
});
