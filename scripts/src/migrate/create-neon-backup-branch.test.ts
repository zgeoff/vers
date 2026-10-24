import { expect, test } from 'bun:test';
import { makeAnswerQueue } from '@vers/test-utils';
import { HttpResponse, http } from 'msw';
import { neonBranchCollection, server } from '../mocks/node';
import { createNeonBackupBranch } from './create-neon-backup-branch';
import { NEON_API_ORIGIN } from './request-neon-json';

test('it creates the backup branch off main with its expiry at second precision', async () => {
  const main = await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  await neonBranchCollection.create({
    name: 'dev',
    parentID: main.id,
    projectID: 'quiet-river-1234',
  });

  const backup = await createNeonBackupBranch({
    apiKey: 'neon-test-key',
    expiresAt: new Date('2026-11-07T09:30:15.250Z'),
    name: 'pre-migrate-4f1c9a2be07d-run-1-1',
    operationPollIntervalMs: 1,
    operationTimeoutMs: 1000,
    projectID: 'quiet-river-1234',
  });

  expect(neonBranchCollection.findFirst((query) => query.where({ id: backup.id }))).toMatchObject({
    expiresAt: '2026-11-07T09:30:15Z',
    id: backup.id,
    name: 'pre-migrate-4f1c9a2be07d-run-1-1',
    parentID: main.id,
    projectID: 'quiet-river-1234',
  });
});

test('it returns the id and name Neon gives the backup branch', async () => {
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  const backup = await createNeonBackupBranch({
    apiKey: 'neon-test-key',
    expiresAt: new Date('2026-11-07T09:30:15Z'),
    name: 'pre-migrate-4f1c9a2be07d-run-1-1',
    operationPollIntervalMs: 1,
    operationTimeoutMs: 1000,
    projectID: 'quiet-river-1234',
  });

  expect(backup).toStrictEqual({
    id: expect.toStartWith('br-'),
    name: 'pre-migrate-4f1c9a2be07d-run-1-1',
  });
});

test('it rejects a project with no main branch', async () => {
  await neonBranchCollection.create({ name: 'dev', projectID: 'quiet-river-1234' });

  expect(
    createNeonBackupBranch({
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    }),
  ).rejects.toThrowWithMessage(Error, 'Neon project quiet-river-1234 has no branch named main');
});

test('it rejects an API key that Neon refuses', async () => {
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  expect(
    createNeonBackupBranch({
      apiKey: '',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    }),
  ).rejects.toMatchObject({ name: 'NeonRequestError', status: 401 });
});

test('it waits for a running branch operation to finish', async () => {
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  const nextStatus = makeAnswerQueue(['running', 'running', 'finished']);

  server.use(
    http.get(`${NEON_API_ORIGIN}/projects/:projectID/operations/:operationID`, (info) =>
      HttpResponse.json({
        operation: {
          action: 'create_branch',
          id: String(info.params['operationID']),
          status: nextStatus(),
        },
      }),
    ),
  );

  await expect(
    createNeonBackupBranch({
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    }),
  ).toResolve();
});

test('it rejects a branch operation that fails', async () => {
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  server.use(
    http.get(`${NEON_API_ORIGIN}/projects/:projectID/operations/:operationID`, () =>
      HttpResponse.json({
        operation: { action: 'create_branch', id: 'op-failed', status: 'failed' },
      }),
    ),
  );

  expect(
    createNeonBackupBranch({
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 1000,
      projectID: 'quiet-river-1234',
    }),
  ).rejects.toThrowWithMessage(Error, 'Neon operation op-failed (create_branch) ended failed');
});

test('it rejects a branch operation still running at the deadline', async () => {
  await neonBranchCollection.create({ name: 'main', projectID: 'quiet-river-1234' });

  server.use(
    http.get(`${NEON_API_ORIGIN}/projects/:projectID/operations/:operationID`, () =>
      HttpResponse.json({
        operation: { action: 'create_branch', id: 'op-slow', status: 'running' },
      }),
    ),
  );

  expect(
    createNeonBackupBranch({
      apiKey: 'neon-test-key',
      expiresAt: new Date('2026-11-07T09:30:15Z'),
      name: 'pre-migrate-4f1c9a2be07d-run-1-1',
      operationPollIntervalMs: 1,
      operationTimeoutMs: 0,
      projectID: 'quiet-river-1234',
    }),
  ).rejects.toThrowWithMessage(
    Error,
    'Neon operation op-slow (create_branch) is still running at the deadline',
  );
});
