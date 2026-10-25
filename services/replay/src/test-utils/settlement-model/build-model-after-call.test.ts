import { expect, test } from 'bun:test';
import { buildMockModelActivity } from '../factories/build-mock-model-activity';
import { buildMockModelCheckpoint } from '../factories/build-mock-model-checkpoint';
import { buildModelAfterCall } from './build-model-after-call';

test('it appends a batch at the head and stamps the delivering device as the writer', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 1 })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 1, forged: false, kind: 'deliver', lastVersion: 3 },
  );

  expect(result.outcome).toStrictEqual({ kind: 'accepted' });

  expect(result.model.activities[0]).toMatchObject({
    appendedHead: 3,
    status: 'active',
    tamperedVersion: null,
    writer: 'device-a',
  });
});

test('it records the last checkpoint of a forged batch as the tampered one', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 1 })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 1, forged: true, kind: 'deliver', lastVersion: 2 },
  );

  expect(result.model.activities[0]?.tamperedVersion).toBe(2);
});

test('it stops a run on a terminal batch and moves the appended anchor to its tail', () => {
  const result = buildModelAfterCall(
    {
      activities: [
        buildMockModelActivity({
          appendedHead: 1,
          checkpoints: [
            buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
            buildMockModelCheckpoint({ type: 'completed', version: 2, xp: 90 }),
          ],
          startChainIndex: 4,
        }),
      ],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 4, scopeID: '0_0', verifiedChainIndex: 4 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 1, forged: false, kind: 'deliver', lastVersion: 2 },
  );

  expect(result.model.activities[0]?.status).toBe('stopped');

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 6, scopeID: '0_0', verifiedChainIndex: 4 },
  ]);
});

test('it refuses a batch that does not extend the head as a conflict', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, writer: 'device-a' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 1, forged: false, kind: 'deliver', lastVersion: 2 },
  );

  expect(result.outcome).toStrictEqual({ code: 'CONFLICT', kind: 'refused' });
});

test('it refuses a batch from a device another device took the run over from', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 1, writer: 'device-b' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 1, forged: false, kind: 'deliver', lastVersion: 2 },
  );

  expect(result.outcome).toStrictEqual({ code: 'SESSION_EVICTED', kind: 'refused' });
});

test('it acknowledges a resend of the batch that ended a run again', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 3, status: 'stopped' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 3, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-b', expectedHead: 1, forged: false, kind: 'deliver', lastVersion: 3 },
  );

  expect(result.outcome).toStrictEqual({ kind: 'accepted' });
});

test('it refuses a batch that reaches past the head of an ended run', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, status: 'stopped' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 2, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', expectedHead: 2, forged: false, kind: 'deliver', lastVersion: 3 },
  );

  expect(result.outcome).toStrictEqual({ code: 'ACTIVITY_TERMINAL', kind: 'refused' });
});

test('it stops a run and moves the appended anchor to its tail', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, writer: 'device-a' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', kind: 'stop' },
  );

  expect(result.outcome).toStrictEqual({ kind: 'accepted' });

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 2, scopeID: '0_0', verifiedChainIndex: 0 },
  ]);
});

test('it leaves the appended anchor where it is for a run stopped on its started checkpoint', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 1 })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', kind: 'stop' },
  );

  expect(result.model.activities[0]?.status).toBe('stopped');

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 },
  ]);
});

test('it leaves the appended anchor where it is once the chain moved past the run start', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2 })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 7, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', kind: 'stop' },
  );

  expect(result.model.chains).toStrictEqual([
    { appendedChainIndex: 7, scopeID: '0_0', verifiedChainIndex: 0 },
  ]);
});

test('it refuses a stop from a device another device took the run over from', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, writer: 'device-b' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-a', kind: 'stop' },
  );

  expect(result.outcome).toStrictEqual({ code: 'SESSION_EVICTED', kind: 'refused' });
});

test('it answers a repeated stop without changing anything', () => {
  const model = {
    activities: [buildMockModelActivity({ appendedHead: 2, status: 'rejected' })],
    avatarXP: 0,
    chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
    grants: [],
    items: [],
  };

  expect(buildModelAfterCall(model, { device: 'device-b', kind: 'stop' })).toStrictEqual({
    model,
    outcome: { kind: 'accepted' },
  });
});

test('it hands an active run to the device that takes it over', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, writer: 'device-a' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 0, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-b', kind: 'takeover' },
  );

  expect(result.outcome).toStrictEqual({ kind: 'accepted' });
  expect(result.model.activities[0]?.writer).toBe('device-b');
});

test('it refuses to take over a run that already ended', () => {
  const result = buildModelAfterCall(
    {
      activities: [buildMockModelActivity({ appendedHead: 2, status: 'stopped' })],
      avatarXP: 0,
      chains: [{ appendedChainIndex: 2, scopeID: '0_0', verifiedChainIndex: 0 }],
      grants: [],
      items: [],
    },
    { device: 'device-b', kind: 'takeover' },
  );

  expect(result.outcome).toStrictEqual({ code: 'NOT_FOUND', kind: 'refused' });
});
