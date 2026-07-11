import { expect, test } from 'bun:test';
import { userEvent } from '@testing-library/user-event';
import { renderWithRouter } from '../test-utils/render-with-router';
import { RootErrorScreen } from './root-error-screen';

test('it explains that an unexpected error occurred', async () => {
  let resetCalls = 0;

  const rendered = renderWithRouter(
    <RootErrorScreen
      error={new Error('boom')}
      reset={() => {
        resetCalls += 1;
      }}
    />,
  );

  const heading = await rendered.findByText('Something went wrong');

  expect(heading).toBeVisible();
  expect(rendered.getByText('An unexpected error interrupted this page.')).toBeVisible();
  expect(resetCalls).toBe(0);
});

test('it offers a retry action wired to the boundary reset', async () => {
  let resetCalls = 0;

  const rendered = renderWithRouter(
    <RootErrorScreen
      error={new Error('boom')}
      reset={() => {
        resetCalls += 1;
      }}
    />,
  );

  const retryButton = await rendered.findByRole('button', { name: 'Try again' });

  await userEvent.click(retryButton);

  expect(resetCalls).toBe(1);
});
