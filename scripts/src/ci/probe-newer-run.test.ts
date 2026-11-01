import { expect, mock, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { probeNewerRun } from './probe-newer-run';

test('it finds a newer run of the workflow on the same branch', async () => {
  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ workflow_id: 77, run_number: 310, head_branch: 'main' }),
    ),
    http.get('https://api.github.test/repos/acme/kiln/actions/workflows/77/runs', () =>
      HttpResponse.json({
        workflow_runs: [{ workflow_id: 77, run_number: 311, head_branch: 'main' }],
      }),
    ),
  );

  const found = await probeNewerRun({
    apiURL: 'https://api.github.test',
    repository: 'acme/kiln',
    runID: '9001',
    token: 'ghs_kiln',
  });

  expect(found).toBeTrue();
});

test('it finds no newer run when the latest run of the workflow is this run', async () => {
  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ workflow_id: 77, run_number: 310, head_branch: 'main' }),
    ),
    http.get('https://api.github.test/repos/acme/kiln/actions/workflows/77/runs', () =>
      HttpResponse.json({
        workflow_runs: [{ workflow_id: 77, run_number: 310, head_branch: 'main' }],
      }),
    ),
  );

  const found = await probeNewerRun({
    apiURL: 'https://api.github.test',
    repository: 'acme/kiln',
    runID: '9001',
    token: 'ghs_kiln',
  });

  expect(found).toBeFalse();
});

test('it lists the runs of the branch with the step token', async () => {
  const received = mock();

  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ workflow_id: 77, run_number: 310, head_branch: 'glaze/picker' }),
    ),
    http.get('https://api.github.test/repos/acme/kiln/actions/workflows/77/runs', (info) => {
      received({
        search: new URL(info.request.url).search,
        authorization: info.request.headers.get('authorization'),
      });

      return HttpResponse.json({ workflow_runs: [] });
    }),
  );

  await probeNewerRun({
    apiURL: 'https://api.github.test',
    repository: 'acme/kiln',
    runID: '9001',
    token: 'ghs_kiln',
  });

  expect(received).toHaveBeenCalledExactlyOnceWith({
    search: '?branch=glaze%2Fpicker&per_page=1',
    authorization: 'Bearer ghs_kiln',
  });
});

test('it rejects a GitHub API answer that is not a success', () => {
  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
    ),
  );

  expect(
    probeNewerRun({
      apiURL: 'https://api.github.test',
      repository: 'acme/kiln',
      runID: '9001',
      token: 'ghs_kiln',
    }),
  ).rejects.toThrowWithMessage(Error, /answered 404/u);
});

test('it rejects a run without its workflow, number and branch', () => {
  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ workflow_id: 77 }),
    ),
  );

  expect(
    probeNewerRun({
      apiURL: 'https://api.github.test',
      repository: 'acme/kiln',
      runID: '9001',
      token: 'ghs_kiln',
    }),
  ).rejects.toThrowWithMessage(Error, /without its workflow, number and branch/u);
});

test('it rejects a run list without workflow_runs', () => {
  server.use(
    http.get('https://api.github.test/repos/acme/kiln/actions/runs/9001', () =>
      HttpResponse.json({ workflow_id: 77, run_number: 310, head_branch: 'main' }),
    ),
    http.get('https://api.github.test/repos/acme/kiln/actions/workflows/77/runs', () =>
      HttpResponse.json({ total_count: 0 }),
    ),
  );

  expect(
    probeNewerRun({
      apiURL: 'https://api.github.test',
      repository: 'acme/kiln',
      runID: '9001',
      token: 'ghs_kiln',
    }),
  ).rejects.toThrowWithMessage(Error, /without workflow_runs/u);
});
