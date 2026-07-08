import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { OnboardingForm } from './onboarding-form';

test('it renders every field the account-creation form collects', async () => {
  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form@vers.test' } } },
    async () => {
      renderWithRouter(<OnboardingForm />);

      const usernameField = await screen.findByLabelText('Username');

      expect(usernameField).toBeVisible();
      expect(screen.getByLabelText('Name')).toBeVisible();
      expect(screen.getByLabelText('Password')).toBeVisible();
      expect(screen.getByLabelText('Confirm Password')).toBeVisible();
      expect(screen.getByLabelText('Agree to terms')).toBeVisible();
      expect(screen.getByLabelText('Remember me')).toBeChecked();
    },
  );
});

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form-honeypot@vers.test' } } },
    async () => {
      renderWithRouter(<OnboardingForm />);

      const honeypotField = await waitFor(() => {
        const field = document.querySelector<HTMLInputElement>('#name__confirm');

        if (field === null) {
          throw new Error('expected the honeypot field to be present');
        }

        return field;
      });

      await user.type(honeypotField, 'filled in by a bot');
      await user.click(screen.getByRole('button', { name: 'Create an Account' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
      });
    },
  );
});
