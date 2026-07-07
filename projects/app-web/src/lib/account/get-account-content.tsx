import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { AccountContent } from '../../routes/-account/account-content';
import { userClient } from '../rpc/clients/user-client';
import { verificationClient } from '../rpc/clients/verification-client';

/**
 * GET server function: reads the caller's own profile and 2FA status and renders the account
 * hub's summary. Called fresh on every loader run (no client-side cache layer of its own), so a
 * mutation that redirects back to `/account` always lands on current data. Untestable end to end
 * under `bun test`: the Flight pipeline it calls into resolves to a client-build stub that
 * unconditionally throws, since `bun test` resolves package exports without the `react-server`
 * condition.
 */
export const getAccountContent = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await userClient.getCurrentUser({});

  const twoFactorVerification = await verificationClient.getVerification({
    target: user.id,
    type: '2fa',
  });

  const has2FA = twoFactorVerification !== null;

  const Renderable = await renderServerComponent(<AccountContent has2FA={has2FA} user={user} />);

  return { has2FA, Renderable };
});
