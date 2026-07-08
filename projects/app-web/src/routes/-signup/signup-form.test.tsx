import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SignupForm } from './signup-form';

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<SignupForm />);

    const emailField = await screen.findByLabelText('Email');

    await user.type(emailField, 'signup-form-honeypot@vers.test');

    const honeypotField = document.querySelector<HTMLInputElement>('#name__confirm');

    if (honeypotField === null) {
      throw new Error('expected the honeypot field to be present');
    }

    await user.type(honeypotField, 'filled in by a bot');
    await user.click(screen.getByRole('button', { name: 'Signup' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });
});
