import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { SimulationUnsupportedNotice } from './simulation-unsupported-notice';

test('it reports the simulation as unavailable', () => {
  render(<SimulationUnsupportedNotice />);

  expect(screen.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});
