import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { sessionContract } from '@vers/contract-session';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { sessionCollection, userCollection } from '../../mocks/db';
import { server } from '../../mocks/node';
import { resolveSessionContext } from '../../mocks/resolve-session-context';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ForceLogoutForm } from './force-logout-form';

test('it disables both buttons while confirming, then re-enables them', async () => {
  const user = userEvent.setup();

  const pendingUser = await userCollection.create({});

  await sessionCollection.create({
    id: 'force-logout-form-session',
    userID: pendingUser.id,
    verified: false,
  });

  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
  });

  const lookupGate = Promise.withResolvers<void>();

  server.use(
    mockSession.getSessions.handler(async (opts) => {
      await lookupGate.promise;

      const actingUserId = opts.context.actingUserId;

      if (actingUserId === null) {
        throw new Error('expected a resolved acting user for the test session bearer token');
      }

      return sessionCollection.findMany((q) => q.where({ userID: actingUserId }));
    }),
  );

  await withRequestContext(
    {
      cookies: {
        en_verification: {
          'loginLogout#email': 'force-logout-form-confirm@vers.test',
          'loginLogout#sessionID': 'force-logout-form-session',
        },
      },
    },
    async () => {
      renderWithRouter(<ForceLogoutForm />);

      const confirmButton = await screen.findByRole('button', { name: 'Confirm' });

      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      });

      lookupGate.resolve();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      });
    },
  );
});

test('it completes a cancel without leaving the buttons stuck disabled', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<ForceLogoutForm />);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    });
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
