import { expect, mock, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import userEvent from '@testing-library/user-event';
import { ActivityCheckpointType } from '@vers/idle-core';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { withRequestContext } from '../../test-utils/with-request-context';
import { RunOutcomePanel } from './run-outcome-panel';

test('it reports a fallen avatar with the xp the run earned', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'stopped' });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: activity.id, kind: ActivityCheckpointType.Failed, xp: 118 }}
      />,
    );

    const heading = await rendered.findByRole('heading', { name: 'Your avatar fell' });

    expect(heading).toBeVisible();
    expect(rendered.getByText('+118 XP')).toBeVisible();
    expect(rendered.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    const empty = await rendered.findByText('No rewards revealed yet.');

    expect(empty).toBeVisible();
  });
});

test('it reports a cleared encounter', async () => {
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: 'activity_1', kind: ActivityCheckpointType.Completed, xp: 240 }}
      />,
    );

    const heading = await rendered.findByRole('heading', { name: 'Encounter cleared' });

    expect(heading).toBeVisible();
    expect(rendered.getByText('+240 XP')).toBeVisible();
  });
});

test('it lists the rewards the ended run has revealed so far', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'stopped',
    verifiedHead: 3,
  });

  await db.avatarItemCollection.create({
    affixes: [{ affixID: 'affix_flat_damage', groupID: 'damage', value: 12 }],
    avatarID: activity.avatarID,
    baseID: 'base_longsword',
    chainIndex: 3,
    contentVersion: 'v1',
    ordinal: 0,
    rarityID: 'rare',
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: activity.id, kind: ActivityCheckpointType.Failed, xp: 118 }}
      />,
    );

    const item = await rendered.findByText('rare base_longsword');

    expect(item).toBeVisible();
    expect(rendered.getByText('affix_flat_damage +12')).toBeVisible();
    expect(rendered.queryByText('No rewards revealed yet.')).not.toBeInTheDocument();
  });
});

test('it says the rewards are still being read while the first page is in flight', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'stopped' });

  server.use(mockActivityService.getActivityRewards.handler(() => new Promise(() => {})));

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: activity.id, kind: ActivityCheckpointType.Failed, xp: 118 }}
      />,
    );

    const reading = await rendered.findByText('Reading rewards…');

    expect(reading).toBeVisible();
    expect(rendered.queryByText('No rewards revealed yet.')).not.toBeInTheDocument();
  });
});

test('it reports rewards it could not load instead of calling them absent', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'stopped' });

  // a refused read: the server holds no row for the run this device played
  server.use(
    mockActivityService.getActivityRewards.handler(() => {
      throw new ORPCError('NOT_FOUND');
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: activity.id, kind: ActivityCheckpointType.Failed, xp: 118 }}
      />,
    );

    const failed = await rendered.findByText('Rewards could not be loaded.');

    expect(failed).toBeVisible();
    expect(rendered.queryByText('No rewards revealed yet.')).not.toBeInTheDocument();
  });
});

test('it offers a retry only when a handler is given and holds it while one is pending', async () => {
  const signedIn = await createSignedInUser();

  const user = userEvent.setup();
  const onRetry = mock(() => {});

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        isRetryPending
        onBackToMap={() => {}}
        onRetry={onRetry}
        outcome={{ activityID: 'activity_1', kind: ActivityCheckpointType.Failed, xp: 0 }}
      />,
    );

    const retry = await rendered.findByRole('button', { name: 'Retry' });

    expect(retry).toBeDisabled();

    await user.click(retry);

    expect(onRetry).not.toHaveBeenCalled();
  });
});

test('it raises the back-to-map action', async () => {
  const signedIn = await createSignedInUser();

  const user = userEvent.setup();
  const onBackToMap = mock(() => {});

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={onBackToMap}
        outcome={{ activityID: 'activity_1', kind: ActivityCheckpointType.Failed, xp: 0 }}
      />,
    );

    const backToMap = await rendered.findByRole('button', { name: 'Back to map' });

    await user.click(backToMap);

    expect(onBackToMap).toHaveBeenCalledOnce();
  });
});
