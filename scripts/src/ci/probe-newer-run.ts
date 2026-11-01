import type { RunLookup } from './types';

export async function probeNewerRun(lookup: Readonly<RunLookup>): Promise<boolean> {
  const runsURL = `${lookup.apiURL}/repos/${lookup.repository}/actions`;

  const runBody = await readGitHubJSON(`${runsURL}/runs/${lookup.runID}`, lookup.token);

  const run = parseRun(runBody);

  const query = new URLSearchParams({ branch: run.branch, per_page: '1' });

  const latestBody = await readGitHubJSON(
    `${runsURL}/workflows/${run.workflowID}/runs?${query.toString()}`,
    lookup.token,
  );

  const latest = parseRunList(latestBody);

  return latest.some((newest) => newest.runNumber > run.runNumber);
}

async function readGitHubJSON(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const answer = await response.text();

    throw new Error(`the GitHub API answered ${response.status} for ${url}: ${answer}`);
  }

  const body: unknown = await response.json();

  return body;
}

interface WorkflowRun {
  workflowID: number;
  runNumber: number;
  branch: string;
}

function parseRun(body: unknown): WorkflowRun {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('workflow_id' in body) ||
    typeof body.workflow_id !== 'number' ||
    !('run_number' in body) ||
    typeof body.run_number !== 'number' ||
    !('head_branch' in body) ||
    typeof body.head_branch !== 'string'
  ) {
    throw new Error(`the GitHub API sent a run without its workflow, number and branch`);
  }

  return { workflowID: body.workflow_id, runNumber: body.run_number, branch: body.head_branch };
}

function parseRunList(body: unknown): Array<WorkflowRun> {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('workflow_runs' in body) ||
    !Array.isArray(body.workflow_runs)
  ) {
    throw new Error('the GitHub API sent a run list without workflow_runs');
  }

  const runs: Array<unknown> = body.workflow_runs;

  return runs.map((run) => parseRun(run));
}
