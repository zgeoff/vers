import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, RouterProvider, createMemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { useIsFormPending } from './use-is-form-pending';

type FormMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
type HTMLFormMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';

interface Props {
  formAction: string;
  formMethod: HTMLFormMethod;
  isPendingAction: string;
  isPendingMethod: HTMLFormMethod;
}

function TestForm(props: Props) {
  const isPending = useIsFormPending({
    formAction: props.isPendingAction,
    formMethod: props.isPendingMethod.toUpperCase() as FormMethod,
  });

  return (
    <Form action={props.formAction} method={props.formMethod}>
      <input name="test" type="text" />
      <button disabled={isPending} type="submit">
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </Form>
  );
}

interface TestConfig {
  formAction: string;
  formMethod: HTMLFormMethod;
  isPendingAction: string;
  isPendingMethod: HTMLFormMethod;
}

function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const router = createMemoryRouter([
    {
      element: (
        <TestForm
          formAction={config.formAction}
          formMethod={config.formMethod}
          isPendingAction={config.isPendingAction}
          isPendingMethod={config.isPendingMethod}
        />
      ),
      path: '/',
    },
    {
      action: async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        return null;
      },
      path: '/test',
    },
    {
      action: async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        return null;
      },
      path: '/custom',
    },
  ]);

  render(<RouterProvider router={router} />);

  return { user };
}

test('it returns false when no form submission is pending', () => {
  setupTest({
    formAction: '/test',
    formMethod: 'post',
    isPendingAction: '/test',
    isPendingMethod: 'post',
  });

  const submitButton = screen.getByRole('button');

  expect(submitButton).toHaveTextContent('Submit');
  expect(submitButton).not.toBeDisabled();
});

test('it returns true when form submission matches the action and method', async () => {
  const { user } = setupTest({
    formAction: '/test',
    formMethod: 'post',
    isPendingAction: '/test',
    isPendingMethod: 'post',
  });

  const submitButton = screen.getByRole('button');

  await user.click(submitButton);

  expect(submitButton).toHaveTextContent('Submitting...');
  expect(submitButton).toBeDisabled();
});

test('it returns false when form submission uses a different method', async () => {
  const { user } = setupTest({
    formAction: '/test',
    formMethod: 'get',
    isPendingAction: '/test',
    isPendingMethod: 'post',
  });

  const submitButton = screen.getByRole('button');

  await user.click(submitButton);

  expect(submitButton).toHaveTextContent('Submit');
  expect(submitButton).not.toBeDisabled();
});

test('it returns false when form submission uses a different action', async () => {
  const { user } = setupTest({
    formAction: '/other',
    formMethod: 'post',
    isPendingAction: '/test',
    isPendingMethod: 'post',
  });

  const submitButton = screen.getByRole('button');

  await user.click(submitButton);

  expect(submitButton).toHaveTextContent('Submit');
  expect(submitButton).not.toBeDisabled();
});

test('it returns true when form submission matches a custom action and method', async () => {
  const { user } = setupTest({
    formAction: '/custom',
    formMethod: 'put',
    isPendingAction: '/custom',
    isPendingMethod: 'put',
  });

  const submitButton = screen.getByRole('button');

  await user.click(submitButton);

  expect(submitButton).toHaveTextContent('Submitting...');
  expect(submitButton).toBeDisabled();
});
