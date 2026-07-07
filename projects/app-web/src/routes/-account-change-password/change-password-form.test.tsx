import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../../test-utils/render-with-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { ChangePasswordForm } from './change-password-form';

/**
 * `change-password-handler.test.ts` drives every `ChangePasswordResult` branch (field errors,
 * invalid credentials, step-up required, and the account redirect) against the handler body
 * directly — a plain result object never round-trips through an uncompiled `createServerFn`
 * export under `bun test`, so this file is limited to the initial render.
 */
test('it renders the password fields and submit button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<ChangePasswordForm />);

    const currentPasswordField = await screen.findByLabelText('Current password');

    expect(currentPasswordField).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
  });
});
