import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckboxField } from './checkbox-field';

test('it renders a label and a checkbox input', () => {
  render(
    <CheckboxField
      checkboxProps={{}}
      errors={[]}
      labelProps={{ children: 'Remember me' }}
    />,
  );

  const checkbox = screen.getByLabelText('Remember me');

  expect(checkbox).toBeInTheDocument();
  expect(checkbox).toHaveRole('checkbox');
});

test('it toggles the checked state on click', async () => {
  const user = userEvent.setup();

  render(
    <CheckboxField
      checkboxProps={{ name: 'rememberMe' }}
      errors={[]}
      labelProps={{ children: 'Remember me' }}
    />,
  );

  const checkbox = screen.getByLabelText('Remember me');

  await user.click(checkbox);

  expect(checkbox).toBeChecked();
});

test('it displays error messages', () => {
  render(
    <CheckboxField
      checkboxProps={{}}
      errors={['This field is required']}
      labelProps={{ children: 'Remember me' }}
    />,
  );

  expect(screen.getByText('This field is required')).toBeInTheDocument();
  expect(screen.getByLabelText('Remember me')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
