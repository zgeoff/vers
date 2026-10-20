import { expect, mock, test } from 'bun:test';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, StatusButton, Text } from '@vers/design-system';
import { z } from 'zod';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import type { FormAction } from './types';
import { useFormSubmit } from './use-form-submit';

interface ReferenceFormProps {
  readonly action?: FormAction;
  readonly lastResult?: SubmissionResult;
  readonly onSuccess?: () => void;
}

function setupTest() {
  const ReferenceSchema = z.object({
    email: z.email('Enter a valid email'),
    password: z.string().min(8, 'Password is too short'),
  });

  // oxlint-disable-next-line react/function-component-definition -- zgeoff/setup-test-only keeps the component in setupTest, where a nested function declaration is banned
  const ReferenceForm = (props: ReferenceFormProps) => {
    const submission = useFormSubmit(
      props.action ?? (() => Promise.resolve(undefined)),
      props.lastResult,
      props.onSuccess,
    );

    const [form, fields] = useForm({
      constraint: getZodConstraint(ReferenceSchema),
      id: 'reference-form',
      lastResult: submission.lastResult,
      onSubmit: submission.onSubmit,
      onValidate(context) {
        return parseWithZod(context.formData, { schema: ReferenceSchema });
      },
    });

    const { key: _emailKey, ...emailProps } = getInputProps(fields.email, { type: 'email' });

    const { key: _passwordKey, ...passwordProps } = getInputProps(fields.password, {
      type: 'password',
    });

    return (
      <form {...getFormProps(form)}>
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{ ...emailProps, placeholder: 'Email' }}
          labelProps={{ children: 'Email', htmlFor: emailProps.id }}
        />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{ ...passwordProps, placeholder: 'Password' }}
          labelProps={{ children: 'Password', htmlFor: passwordProps.id }}
        />
        {form.errors !== undefined && <Text role="alert">{form.errors[0]}</Text>}
        <StatusButton
          disabled={submission.isPending}
          status={submission.isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
        >
          Sign in
        </StatusButton>
      </form>
    );
  };

  return { ReferenceForm };
}

test('it shows a form-level error message', async () => {
  const ctx = setupTest();

  renderWithRouter(
    <ctx.ReferenceForm
      lastResult={{ error: { '': ['Invalid email or password'] }, status: 'error' }}
    />,
  );

  const alert = await screen.findByRole('alert');

  expect(alert).toHaveTextContent('Invalid email or password');
});

test('it shows an error on the field it belongs to', async () => {
  const ctx = setupTest();

  renderWithRouter(
    <ctx.ReferenceForm
      lastResult={{ error: { email: ['That email is taken'] }, status: 'error' }}
    />,
  );

  const fieldError = await screen.findByText('That email is taken');

  expect(fieldError).toBeInTheDocument();
});

test('it shows a generic error message when the server rejects the submission', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();

  renderWithRouter(
    <ctx.ReferenceForm action={() => Promise.resolve(new Response(null, { status: 400 }))} />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  const alert = await screen.findByRole('alert');

  expect(alert).toHaveTextContent('Something went wrong. Please try again.');
});

test('it shows the generic error message when the action rejects', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();

  renderWithRouter(
    <ctx.ReferenceForm action={() => Promise.reject(new Error('Service Unavailable'))} />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  const alert = await screen.findByRole('alert');

  expect(alert).toHaveTextContent('Something went wrong. Please try again.');
});

test('it re-enables the submit button after the action rejects', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();

  renderWithRouter(
    <ctx.ReferenceForm action={() => Promise.reject(new Error('Service Unavailable'))} />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('alert');

  expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
});

test('it keeps the typed values when the action rejects', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();

  renderWithRouter(
    <ctx.ReferenceForm action={() => Promise.reject(new Error('Service Unavailable'))} />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('alert');

  expect(screen.getByPlaceholderText('Email')).toHaveValue('player@vers.test');
});

test('it reports no success when the action rejects', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();
  const onSuccess = mock(() => {});

  renderWithRouter(
    <ctx.ReferenceForm
      action={() => Promise.reject(new Error('Service Unavailable'))}
      onSuccess={onSuccess}
    />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('alert');

  expect(onSuccess).not.toHaveBeenCalled();
});

test('it shows no error after a redirect resolves the submission', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();

  renderWithRouter(<ctx.ReferenceForm action={() => Promise.resolve(undefined)} />);

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('it reports success once a redirect resolves the submission', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();
  const onSuccess = mock(() => {});

  renderWithRouter(
    <ctx.ReferenceForm action={() => Promise.resolve(undefined)} onSuccess={onSuccess} />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => {
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

test('it reports no success when the server rejects the submission', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();
  const onSuccess = mock(() => {});

  renderWithRouter(
    <ctx.ReferenceForm
      action={() => Promise.resolve(new Response(null, { status: 400 }))}
      onSuccess={onSuccess}
    />,
  );

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('alert');

  expect(onSuccess).not.toHaveBeenCalled();
});

test('it disables the submit button while the action is in flight', async () => {
  const ctx = setupTest();
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction = mock(() => deferred.promise);

  renderWithRouter(<ctx.ReferenceForm action={gatedAction} />);

  const emailInput = await screen.findByPlaceholderText('Email');

  await user.type(emailInput, 'player@vers.test');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();

  await deferred.release(undefined);

  expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
});
