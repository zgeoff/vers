import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { setSimulationSpeed } from '@vers/idle-client';
import { QASpeedBadge } from './qa-speed-badge';

test('it shows the multiplier while the simulation runs above real time', () => {
  setSimulationSpeed(8);

  const rendered = render(<QASpeedBadge />);

  expect(rendered.getByRole('status')).toHaveTextContent('QA ×8');
});

test('it renders nothing at real time', () => {
  setSimulationSpeed(1);

  const rendered = render(<QASpeedBadge />);

  expect(rendered.queryByRole('status')).toBeNull();
});
