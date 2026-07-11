import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormAction } from '../../lib/forms/types';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { OnboardingForm } from './onboarding-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

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

test('it shows the error for the username field', async () => {
  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form@vers.test' } } },
    async () => {
      renderWithRouter(
        <OnboardingForm
          lastResult={{
            error: { username: ['A user with that username already exists'] },
            status: 'error',
          }}
        />,
      );

      const usernameError = await screen.findByText('A user with that username already exists');

      expect(usernameError).toBeInTheDocument();
    },
  );
});

test('it shows the error for the confirm-password field', async () => {
  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form@vers.test' } } },
    async () => {
      renderWithRouter(
        <OnboardingForm
          lastResult={{ error: { confirmPassword: ['The passwords must match'] }, status: 'error' }}
        />,
      );

      const confirmError = await screen.findByText('The passwords must match');

      expect(confirmError).toBeInTheDocument();
    },
  );
});

test('it shows a generic failure message when the server rejects the submission', async () => {
  const user = userEvent.setup();

  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form-honeypot@vers.test' } } },
    async () => {
      renderWithRouter(<OnboardingForm action={rejectWithResponse} />);

      const usernameField = await screen.findByLabelText('Username');

      await user.type(usernameField, 'john_smith13');
      await user.type(screen.getByLabelText('Name'), 'John Smith');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByLabelText('Agree to terms'));
      await user.click(screen.getByRole('button', { name: 'Create an Account' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
      });
    },
  );
});

test('it disables the submit button while the account-creation request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction: FormAction = () => deferred.promise;

  await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboarding-form-pending@vers.test' } } },
    async () => {
      renderWithRouter(<OnboardingForm action={gatedAction} />);

      const usernameField = await screen.findByLabelText('Username');

      await user.type(usernameField, 'john_smith13');
      await user.type(screen.getByLabelText('Name'), 'John Smith');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByLabelText('Agree to terms'));
      await user.click(screen.getByRole('button', { name: 'Create an Account' }));

      expect(screen.getByRole('button', { name: 'Create an Account' })).toBeDisabled();

      await deferred.release(undefined);

      expect(screen.getByRole('button', { name: 'Create an Account' })).not.toBeDisabled();
    },
  );
});
