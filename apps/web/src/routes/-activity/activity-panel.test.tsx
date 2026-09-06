import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setRunOutcome, setSimulationSnapshot } from '@vers/idle-client';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { render } from '../../test-utils/render';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityPanel } from './activity-panel';

test('it renders the engagement title with no settling indicator by default', () => {
  const rendered = render(<ActivityPanel />);

  expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
  expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
});

test('it shows the settling indicator while appended progress is still settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    const indicators = await rendered.findAllByTestId('settling-indicator');

    expect(indicators).toHaveLength(1);
  });
});

test('it shows no settling indicator once the appended progress is fully verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 2,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    const heading = await rendered.findByRole('heading', { name: 'Engagement' });

    expect(heading).toBeVisible();
    expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
  });
});

test('it hands END RUN to the worker and never awaits the server', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot(),
    avatar: createMockAvatarSnapshot(),
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot(),
    avatar: createMockAvatarSnapshot(),
    failureAction: ActivityFailureAction.Abort,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const endRunButton = await rendered.findByRole('button', { name: 'END RUN' });

    endRunButton.click();

    await waitFor(() => {
      expect(client.stopActivity).toHaveBeenCalledExactlyOnceWith(
        { activityID: activity.id, avatarID: avatar.id },
        expect.anything(),
      );
    });
  });
});

test('it shows the outcome instead of the fight once the run has failed', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  setRunOutcome({
    activityID: 'activity_ended',
    kind: ActivityCheckpointType.Failed,
    run: { avatarID: avatar.id, scopeID: '0_0', scopeType: 'world_map_node' },
    xp: 118,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const heading = await rendered.findByRole('heading', { name: 'Your avatar fell' });

    expect(heading).toBeVisible();
    expect(rendered.getByText('+118 XP')).toBeVisible();
    expect(rendered.queryByRole('button', { name: 'END RUN' })).not.toBeInTheDocument();
  });
});

test('it shows the outcome once the run has been cleared', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setRunOutcome({ activityID: 'activity_ended', kind: ActivityCheckpointType.Completed, xp: 240 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const heading = await rendered.findByRole('heading', { name: 'Encounter cleared' });

    expect(heading).toBeVisible();
  });
});

test('it hands Retry to the worker for the node the ended run played', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  const user = userEvent.setup();
  const client = createStubWorkerClient();

  const writerAbortSignal = new AbortController().signal;

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal,
  });

  setRunOutcome({
    activityID: 'activity_ended',
    kind: ActivityCheckpointType.Failed,
    run: { avatarID: avatar.id, scopeID: '3_4', scopeType: 'world_map_node' },
    xp: 118,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const retry = await rendered.findByRole('button', { name: 'Retry' });

    await user.click(retry);

    expect(client.startActivity).toHaveBeenCalledExactlyOnceWith(
      { avatarID: avatar.id, scopeID: '3_4', scopeType: 'world_map_node' },
      { signal: writerAbortSignal },
    );
  });
});

test('it offers no retry when the ended run named no node', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  setRunOutcome({ activityID: 'activity_ended', kind: ActivityCheckpointType.Failed, xp: 118 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    await rendered.findByRole('button', { name: 'Back to map' });

    expect(rendered.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

test('it sends Back to map to the explore route', async () => {
  const signedIn = await createSignedInUser();

  const user = userEvent.setup();

  await createActiveAvatar({ userID: signedIn.userID });

  setRunOutcome({ activityID: 'activity_ended', kind: ActivityCheckpointType.Failed, xp: 118 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />, {
      routes: { '/explore': <p>explore marker</p> },
    });

    const backToMap = await rendered.findByRole('button', { name: 'Back to map' });

    await user.click(backToMap);

    await waitFor(() => {
      expect(rendered.router.state.location.pathname).toBe('/explore');
    });
  });
});

test('it replaces the outcome with the next live run once a continuation installs', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  setRunOutcome({ activityID: 'activity_ended', kind: ActivityCheckpointType.Failed, xp: 118 });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_next', name: 'Next Encounter' }),
    avatar: createMockAvatarSnapshot(),
    failureAction: ActivityFailureAction.Retry,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const title = await rendered.findByText('Next Encounter');

    expect(title).toBeVisible();
    expect(rendered.queryByTestId('run-outcome-panel')).not.toBeInTheDocument();
  });
});
