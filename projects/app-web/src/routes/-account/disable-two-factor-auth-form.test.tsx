import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { DisableTwoFactorAuthForm } from './disable-two-factor-auth-form';

/**
 * `disable-two-factor-auth-handler.test.ts` drives every `DisableTwoFactorAuthResult` branch
 * against the handler body directly — a plain result object never round-trips through an
 * uncompiled `createServerFn` export under `bun test`, so this file is limited to the initial
 * render.
 */
test('it renders the disable-2FA button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<DisableTwoFactorAuthForm />);

    const disableButton = await screen.findByRole('button', { name: 'Disable 2FA' });

    expect(disableButton).toBeInTheDocument();
  });
});
