import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StatusButton } from './status-button';

test('it renders children content', () => {
  render(<StatusButton status={StatusButton.Status.Idle}>Click me</StatusButton>);

  const button = screen.getByRole('button', { name: 'Click me' });

  expect(button).toBeInTheDocument();
});

test('it can be disabled', () => {
  render(
    <StatusButton status={StatusButton.Status.Idle} disabled>
      Click me
    </StatusButton>,
  );

  const button = screen.getByRole('button', { name: 'Click me' });

  expect(button).toBeDisabled();
});

test('it shows loading state when pending', () => {
  render(<StatusButton status={StatusButton.Status.Pending}>Click me</StatusButton>);

  const statusIndicator = screen.getByRole('status');

  expect(statusIndicator).toBeInTheDocument();
});

test('it shows success state', () => {
  render(<StatusButton status={StatusButton.Status.Success}>Click me</StatusButton>);

  const successIndicator = screen.getByRole('img', { name: /success/i });

  expect(successIndicator).toBeInTheDocument();
});

test('it shows error state', () => {
  render(<StatusButton status={StatusButton.Status.Error}>Click me</StatusButton>);

  const errorIndicator = screen.getByRole('img', { name: /error/i });

  expect(errorIndicator).toBeInTheDocument();
});
