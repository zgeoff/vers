import { expect, mock, test } from 'bun:test';
import userEvent from '@testing-library/user-event';
import { ActivityCheckpointType } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { withRequestContext } from '../../test-utils/with-request-context';
import { RunOutcomePanel } from './run-outcome-panel';

test('it reports a fallen avatar with the xp the run earned', async () => {
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(
      <RunOutcomePanel
        onBackToMap={() => {}}
        outcome={{ activityID: 'activity_1', kind: ActivityCheckpointType.Failed, xp: 118 }}
      />,
    );

    const heading = await rendered.findByRole('heading', { name: 'Your avatar fell' });

    expect(heading).toBeVisible();
    expect(rendered.getByText('+118 XP')).toBeVisible();
    expect(rendered.getByText('No rewards revealed yet.')).toBeVisible();
    expect(rendered.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
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
    affixes: [],
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
