import { expect, test } from 'bun:test';
import { createMockAppMachine } from './create-mock-app-machine';

test('it builds a default started app machine', () => {
  const machine = createMockAppMachine();

  expect(machine).toStrictEqual({
    checks: [],
    gitSHA: expect.toBeString(),
    id: expect.toBeString(),
    image: expect.toStartWith('registry.fly.io/'),
    state: 'started',
  });
});

test('it applies overrides on top of the defaults', () => {
  const machine = createMockAppMachine({ gitSHA: null, id: 'm1', state: 'suspended' });

  expect(machine).toStrictEqual({
    checks: [],
    gitSHA: null,
    id: 'm1',
    image: expect.toStartWith('registry.fly.io/'),
    state: 'suspended',
  });
});
