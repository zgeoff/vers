import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { OTPField } from './otp-field';

test('it renders six code inputs', () => {
  render(<OTPField errors={[]} inputProps={{ name: 'code' }} />);

  const inputs = screen.getAllByRole('textbox');

  expect(inputs).toHaveLength(6);
});

test('it collects typed digits into the submitted value', async () => {
  const user = userEvent.setup();

  render(<OTPField errors={[]} inputProps={{ name: 'code' }} />);

  await user.click(screen.getByTestId('otp-input'));
  await user.keyboard('123456');

  expect(document.querySelector('input[name="code"]')).toHaveValue('123456');
});

test('it distributes a single fill across all inputs', async () => {
  render(<OTPField errors={[]} inputProps={{ name: 'code' }} />);

  const fillTarget = screen.getByTestId('otp-input');

  fireEvent.focus(fillTarget);
  fireEvent.input(fillTarget, { target: { value: '999999' } });

  const inputs = screen.getAllByRole('textbox');

  await waitFor(() => {
    expect(inputs[5]).toHaveValue('9');
  });

  expect(document.querySelector('input[name="code"]')).toHaveValue('999999');
});

test('it displays error messages', () => {
  render(<OTPField errors={['Invalid code']} inputProps={{ name: 'code' }} />);

  const error = screen.getByText('Invalid code');
  const [firstInput] = screen.getAllByRole('textbox');

  expect(error).toBeInTheDocument();
  expect(firstInput).toHaveAttribute('aria-invalid', 'true');
});
