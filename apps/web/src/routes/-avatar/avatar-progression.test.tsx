import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { AvatarProgression } from './avatar-progression';

test('it renders nothing without a signed-in avatar', async () => {
  await withRequestContext({}, async () => {
    const rendered = render(<AvatarProgression />);

    await waitFor(() => {
      expect(rendered.container).toBeEmptyDOMElement();
    });
  });
});

test('it renders the settled row with no settling marker when nothing is pending', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ level: 5, userID: signedIn.userID, xp: 900 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<AvatarProgression />);

    const level = await rendered.findByTestId('avatar-level');

    expect(level).toHaveTextContent('Level 5');
    expect(rendered.getByTestId('avatar-xp')).toHaveTextContent('XP: 900');
    expect(rendered.queryByTestId('avatar-progression-settling')).not.toBeInTheDocument();
  });
});

test('it sums a pending entry onto the settled xp and shows the settling marker', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ level: 1, userID: signedIn.userID, xp: 400 });

  const activity = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: avatar.id,
    status: 'stopped',
  });

  await db.checkpointCollection.create({
    activityID: activity.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'a'.repeat(32),
      rewards: { xp: 150 },
      seed: 'a'.repeat(32),
      time: 1000,
      type: 'completed',
    },
    version: 1,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<AvatarProgression />);

    const xp = await rendered.findByTestId('avatar-xp');

    await waitFor(() => {
      expect(xp).toHaveTextContent('XP: 550');
    });

    expect(rendered.getByTestId('avatar-progression-settling')).toBeInTheDocument();
  });
});

test('it shows the optimistic sim overlay and the settling marker while an activity is current', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ level: 3, userID: signedIn.userID, xp: 450 });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'active',
  });

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot({ id: activity.id, rewards: { xp: 25 } }),
    avatar: createMockAvatarSnapshot({ level: 4 }),
    client: undefined,
    failureAction: ActivityFailureAction.Retry,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<AvatarProgression />);

    const xp = await rendered.findByTestId('avatar-xp');

    await waitFor(() => {
      expect(xp).toHaveTextContent('XP: 475');
    });

    expect(rendered.getByTestId('avatar-progression-settling')).toBeInTheDocument();
  });
});
