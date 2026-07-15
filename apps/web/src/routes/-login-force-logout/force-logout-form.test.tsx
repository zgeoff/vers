import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormAction } from '../../lib/forms/types';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ForceLogoutForm } from './force-logout-form';

test('it disables both buttons while confirming, then re-enables them', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const mockGatedAction: FormAction = () => deferred.promise;

  await withRequestContext({}, async () => {
    renderWithRouter(<ForceLogoutForm action={mockGatedAction} />);

    const confirmButton = await screen.findByRole('button', { name: 'Confirm' });

    await user.click(confirmButton);

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
  });
});

test('it completes a cancel without leaving the buttons stuck disabled', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const mockGatedAction: FormAction = () => deferred.promise;

  await withRequestContext({}, async () => {
    renderWithRouter(<ForceLogoutForm action={mockGatedAction} />);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

    await user.click(cancelButton);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
  });
});

test('it renders the informational copy explaining why a force logout is needed', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<ForceLogoutForm />);

    const infoText = await screen.findByText('You are currently logged in somewhere else.', {
      exact: false,
    });

    expect(infoText).toBeVisible();
  });
});
