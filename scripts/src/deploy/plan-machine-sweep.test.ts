import { expect, test } from 'bun:test';
import { planMachineSweep } from './plan-machine-sweep';

test('it treats a fleet on a single image as clean', () => {
  const machines = [
    { checks: [], gitSHA: 'sha1', id: 'm1', image: 'img1', state: 'started' },
    { checks: [], gitSHA: 'sha1', id: 'm2', image: 'img1', state: 'suspended' },
  ];

  expect(planMachineSweep(machines, null)).toStrictEqual({ kind: 'clean' });
});

test('it treats an empty fleet as clean', () => {
  expect(planMachineSweep([], null)).toStrictEqual({ kind: 'clean' });
});

test('it keeps the image group matching the recorded release and sweeps the rest', () => {
  const machines = [
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaNEW',
      id: 'm1',
      image: 'img-new',
      state: 'started',
    },
    { checks: [], gitSHA: 'shaOLD', id: 'm2', image: 'img-old', state: 'suspended' },
  ];

  expect(planMachineSweep(machines, { gitSHA: 'shaNEW' })).toStrictEqual({
    kind: 'sweep',
    machines: [{ id: 'm2', image: 'img-old' }],
  });
});

test('it falls back to the healthy started group when the recorded SHA matches no group', () => {
  const machines = [
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaOLD',
      id: 'm1',
      image: 'img-a',
      state: 'started',
    },
    { checks: [], gitSHA: 'shaOLD2', id: 'm2', image: 'img-b', state: 'suspended' },
  ];

  expect(planMachineSweep(machines, { gitSHA: 'shaNEW' })).toStrictEqual({
    kind: 'sweep',
    machines: [{ id: 'm2', image: 'img-b' }],
  });
});

test('it keeps the single healthy started group when no release is recorded', () => {
  const machines = [
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaA',
      id: 'm1',
      image: 'img-a',
      state: 'started',
    },
    { checks: [], gitSHA: 'shaB', id: 'm2', image: 'img-b', state: 'suspended' },
  ];

  expect(planMachineSweep(machines, null)).toStrictEqual({
    kind: 'sweep',
    machines: [{ id: 'm2', image: 'img-b' }],
  });
});

test('it reports ambiguous with no recorded release and no started machine', () => {
  const machines = [
    { checks: [], gitSHA: 'shaA', id: 'm1', image: 'img-a', state: 'suspended' },
    { checks: [], gitSHA: 'shaB', id: 'm2', image: 'img-b', state: 'suspended' },
  ];

  const plan = planMachineSweep(machines, null);

  expect(plan).toStrictEqual({
    kind: 'ambiguous',
    reason: 'no recorded release to match, and no image group has a healthy started machine',
  });
});

test('it reports ambiguous when two image groups each have a healthy started machine', () => {
  const machines = [
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaA',
      id: 'm1',
      image: 'img-a',
      state: 'started',
    },
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaB',
      id: 'm2',
      image: 'img-b',
      state: 'started',
    },
  ];

  const plan = planMachineSweep(machines, null);

  expect(plan).toStrictEqual({
    kind: 'ambiguous',
    reason: '2 image groups each have a healthy started machine — ambiguous which is current',
  });
});

test('it reports ambiguous when a started machine sits outside the chosen keep group', () => {
  const machines = [
    {
      checks: [{ name: 'http', status: 'passing' }],
      gitSHA: 'shaNEW',
      id: 'm1',
      image: 'img-new',
      state: 'started',
    },
    { checks: [], gitSHA: 'shaOLD', id: 'm2', image: 'img-old', state: 'started' },
  ];

  const plan = planMachineSweep(machines, { gitSHA: 'shaNEW' });

  expect(plan).toStrictEqual({
    kind: 'ambiguous',
    reason:
      'machine(s) m2 are started on an image outside the kept group — refusing to destroy a started machine',
  });
});

test('it never counts a started machine with no checks as healthy for the fallback', () => {
  const machines = [
    { checks: [], gitSHA: 'shaA', id: 'm1', image: 'img-a', state: 'started' },
    { checks: [], gitSHA: 'shaB', id: 'm2', image: 'img-b', state: 'suspended' },
  ];

  const plan = planMachineSweep(machines, null);

  expect(plan).toStrictEqual({
    kind: 'ambiguous',
    reason: 'no recorded release to match, and no image group has a healthy started machine',
  });
});
