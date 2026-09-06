import { expect, test } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { CheckboxField } from './checkbox-field';

test('it renders a label and a checkbox input', () => {
  render(<CheckboxField checkboxProps={{}} errors={[]} labelProps={{ children: 'Remember me' }} />);

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
  expect(screen.getByLabelText('Remember me')).toHaveAttribute('aria-invalid', 'true');
});

test('it adopts a click that landed on the native input before hydration', async () => {
  const container = document.createElement('div');

  document.body.append(container);

  container.innerHTML = renderToString(
    <CheckboxField
      checkboxProps={{ defaultChecked: true, id: 'remember-me', name: 'rememberMe' }}
      errors={[]}
      labelProps={{ children: 'Remember me', htmlFor: 'remember-me' }}
    />,
  );

  container.querySelector('input')?.click();

  render(
    <CheckboxField
      checkboxProps={{ defaultChecked: true, id: 'remember-me', name: 'rememberMe' }}
      errors={[]}
      labelProps={{ children: 'Remember me', htmlFor: 'remember-me' }}
    />,
    { container, hydrate: true },
  );

  await waitFor(() => {
    expect(container.querySelector('[data-part="control"]')).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  expect(screen.getByLabelText('Remember me')).not.toBeChecked();
});
