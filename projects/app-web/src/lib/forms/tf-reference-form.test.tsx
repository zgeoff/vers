import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import type { TFAction } from './tf-reference-form';
import { TFReferenceForm } from './tf-reference-form';

test('it maps a fabricated form-level result onto a form error with no submit', async () => {
  renderWithRouter(<TFReferenceForm serverState={{ form: ['Invalid email or password'] }} />);

  const alert = await screen.findByRole('alert');

  expect(alert).toHaveTextContent('Invalid email or password');
});

test('it maps a fabricated field result onto that field with no submit', async () => {
  renderWithRouter(
    <TFReferenceForm serverState={{ fields: { email: ['That email is taken'] } }} />,
  );

  const fieldError = await screen.findByText('That email is taken');

  expect(fieldError).toBeInTheDocument();
});

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

test('it maps a returned Response onto a generic form error', async () => {
  const user = userEvent.setup();

  renderWithRouter(<TFReferenceForm action={rejectWithResponse} />);

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});

test('it shows no error after a redirect resolves the submission', async () => {
  const user = userEvent.setup();

  renderWithRouter(<TFReferenceForm />);

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('it disables the submit button while the action is in flight', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<'redirect'>();
  const gatedAction: TFAction = () => deferred.promise;

  renderWithRouter(<TFReferenceForm action={gatedAction} />);

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  await deferred.release('redirect');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });
});
