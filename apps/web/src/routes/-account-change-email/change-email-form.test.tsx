import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ChangeEmailForm } from './change-email-form';

test('it renders the new-email field and submit button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<ChangeEmailForm />);

    const emailField = await screen.findByLabelText('New email address');

    expect(emailField).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument();
  });
});
