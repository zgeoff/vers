import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDevStore } from '../state/use-dev-store';
import { DevTools } from './dev-tools';

function setupTest() {
  const user = userEvent.setup();

  render(<DevTools />);

  return { user };
}

test('it renders all dev tool controls', () => {
  setupTest();

  const devCameraField = screen.getByLabelText('Dev Camera');
  const axesHelperField = screen.getByLabelText('Axes Helper');

  expect(devCameraField).toBeInTheDocument();
  expect(axesHelperField).toBeInTheDocument();
});

test('it toggles the axes helper visibility', async () => {
  const ctx = setupTest();

  const axesHelperCheckbox = screen.getByLabelText('Axes Helper');

  expect(axesHelperCheckbox).not.toBeChecked();

  await ctx.user.click(axesHelperCheckbox);

  expect(axesHelperCheckbox).toBeChecked();

  expect(useDevStore.getState()).toMatchObject({
    isAxesHelperVisible: true,
  });
});

test('it toggles the dev camera', async () => {
  const ctx = setupTest();

  const devCameraCheckbox = screen.getByLabelText('Dev Camera');

  expect(devCameraCheckbox).not.toBeChecked();

  await ctx.user.click(devCameraCheckbox);

  expect(devCameraCheckbox).toBeChecked();

  expect(useDevStore.getState()).toMatchObject({
    isDevCameraActive: true,
  });
});
