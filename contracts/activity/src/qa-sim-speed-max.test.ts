import { expect, test } from 'bun:test';
import { QA_SIM_SPEED_MAX } from './qa-sim-speed-max';

test('it caps a QA run at twenty fixed steps per real-time step', () => {
  expect(QA_SIM_SPEED_MAX).toBe(20);
});
