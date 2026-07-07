import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { sessionContract } from '@vers/contract-session';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { server } from '../../../mocks/node';
import { resolveSessionContext } from '../../../mocks/resolve-session-context';
import { renderWithRouter } from '../../../test-utils/render-with-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { ForceLogoutForm } from './force-logout-form';

/**
 * `force-logout-handler.test.ts` drives every branch of the handler body directly. Every branch
 * here ends in a thrown redirect, which `useServerFn` catches and hands to a real
 * `router.navigate` — `waitFor`'s `act()` wrapping never observes that settling, so a plain delay
 * stands in for it below.
 */
test('it disables both buttons while confirming, then re-enables them', async () => {
  const user = userEvent.setup();

  const pendingUser = await userCollection.create({
    createdAt: new Date(),
    email: 'force-logout-form-confirm@vers.test',
    id: createId(),
    name: 'Force Logout Form Confirm',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'force-logout-form-confirm',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: 'force-logout-form-session',
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID: pendingUser.id,
    verified: false,
  });

  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
  });

  server.use(
    mockSession.getSessions.handler(async (opts) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

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

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    },
  );
});

test('it completes a cancel without leaving the buttons stuck disabled', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<ForceLogoutForm />);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

    await user.click(cancelButton);

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });

    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
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
