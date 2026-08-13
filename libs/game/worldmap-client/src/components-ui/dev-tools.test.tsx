import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setPerfStats } from '../state/set-perf-stats';
import { useWorldmapStore } from '../state/use-worldmap-store';
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
  const fogOfWarField = screen.getByLabelText('Fog of War');
  const scatterField = screen.getByLabelText('Scatter');

  expect(devCameraField).toBeInTheDocument();
  expect(axesHelperField).toBeInTheDocument();
  expect(fogOfWarField).toBeInTheDocument();
  expect(scatterField).toBeInTheDocument();
});

test('it toggles the axes helper visibility', async () => {
  const ctx = setupTest();
  const axesHelperCheckbox = screen.getByLabelText('Axes Helper');

  expect(axesHelperCheckbox).not.toBeChecked();

  await ctx.user.click(axesHelperCheckbox);

  expect(axesHelperCheckbox).toBeChecked();

  expect(useWorldmapStore.getState()).toMatchObject({
    isAxesHelperVisible: true,
  });
});

test('it toggles the dev camera', async () => {
  const ctx = setupTest();
  const devCameraCheckbox = screen.getByLabelText('Dev Camera');

  expect(devCameraCheckbox).not.toBeChecked();

  await ctx.user.click(devCameraCheckbox);

  expect(devCameraCheckbox).toBeChecked();

  expect(useWorldmapStore.getState()).toMatchObject({
    isDevCameraActive: true,
  });
});

test('it toggles scatter visibility', async () => {
  const ctx = setupTest();
  const scatterCheckbox = screen.getByLabelText('Scatter');

  expect(scatterCheckbox).toBeChecked();

  await ctx.user.click(scatterCheckbox);

  expect(scatterCheckbox).not.toBeChecked();

  expect(useWorldmapStore.getState()).toMatchObject({
    isScatterVisible: false,
  });
});

test('it renders no perf HUD before the frame probe samples anything', () => {
  setupTest();

  expect(screen.queryByText(/^fps /)).not.toBeInTheDocument();
});

test('it renders the sampled perf HUD once the store carries a snapshot', () => {
  setPerfStats({
    drawCalls: 12,
    fps: 60,
    scatterBuildMs: 24,
    scatterGlowCount: 40,
    scatterPartCount: 400,
    triangleCount: 12_000,
    worstFrameMs: 7,
  });

  setupTest();

  expect(screen.getByText('fps 60 worst 7ms')).toBeInTheDocument();
  expect(screen.getByText('draws 12 tris 12k')).toBeInTheDocument();
  expect(screen.getByText('scatter 400 parts + 40 glow')).toBeInTheDocument();
  expect(screen.getByText('last scatter build 24ms')).toBeInTheDocument();
});
