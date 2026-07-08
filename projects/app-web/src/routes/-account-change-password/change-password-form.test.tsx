import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ChangePasswordForm } from './change-password-form';

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
