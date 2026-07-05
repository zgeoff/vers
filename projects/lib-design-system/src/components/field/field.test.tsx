import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChangeEvent } from 'react';
import { expect, test, vi } from 'vitest';
import { Field } from './field';

test('it renders a label and an input', () => {
  render(<Field errors={[]} inputProps={{ type: 'email' }} labelProps={{ children: 'Email' }} />);

  const input = screen.getByLabelText('Email');

  expect(input).toBeInTheDocument();
  expect(input).toHaveAttribute('type', 'email');
});

test('it handles input changes', async () => {
  const handleChange = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>();
  const user = userEvent.setup();

  render(
    <Field
      errors={[]}
      inputProps={{ onChange: handleChange, type: 'email' }}
      labelProps={{ children: 'Email' }}
    />,
  );

  await user.type(screen.getByLabelText('Email'), 'test@example.com');

  expect(handleChange).toHaveBeenCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({
        value: 'test@example.com',
      }),
    }),
  );
});

test('it displays error messages', () => {
  render(
    <Field
      errors={['Invalid email address']}
      inputProps={{ type: 'email' }}
      labelProps={{ children: 'Email' }}
    />,
  );

  const input = screen.getByLabelText('Email');
  const errorMessage = screen.getByText('Invalid email address');

  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(errorMessage).toBeInTheDocument();
});
