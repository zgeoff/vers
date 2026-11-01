import { buildDiscordAlert } from './build-discord-alert';
import { probeNewerRun } from './probe-newer-run';
import type { RunLookup } from './types';

type AlertOutcome = 'sent' | 'no-webhook' | 'superseded';

// The alert imports no package, so it runs after a failed `bun install` and reports that failure.
export async function writeDiscordAlert(
  env: Readonly<Record<string, string | undefined>>,
): Promise<AlertOutcome> {
  const webhookURL = findValue(env, 'WEBHOOK_URL');

  if (webhookURL === undefined) {
    return 'no-webhook';
  }

  if (findValue(env, 'CANCELLED_NEED') === 'true') {
    const isSuperseded = await probeSuperseded(env);

    if (isSuperseded) {
      return 'superseded';
    }
  }

  const body = buildDiscordAlert({
    title: getValue(env, 'ALERT_TITLE'),
    runURL: getValue(env, 'RUN_URL'),
    description: env['ALERT_DESCRIPTION'] ?? '',
    failedJobs: findValue(env, 'ALERT_FAILED_JOBS'),
  });

  const response = await fetch(webhookURL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const answer = await response.text();

    throw new Error(`the Discord webhook answered ${response.status}: ${answer}`);
  }

  return 'sent';
}

// a workflow passes an unset secret or optional value as an empty string
function findValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const value = env[name];

  return value === '' ? undefined : value;
}

// a cancelled need may be a timeout, so only a lookup that finds a newer run drops the alert
async function probeSuperseded(
  env: Readonly<Record<string, string | undefined>>,
): Promise<boolean> {
  try {
    return await probeNewerRun(getRunLookup(env));
  } catch (error) {
    console.error(`the newer-run lookup failed, so the alert goes out: ${String(error)}`);

    return false;
  }
}

// the runner sets GITHUB_API_URL, GITHUB_REPOSITORY and GITHUB_RUN_ID in every step
function getRunLookup(env: Readonly<Record<string, string | undefined>>): RunLookup {
  return {
    apiURL: getValue(env, 'GITHUB_API_URL'),
    repository: getValue(env, 'GITHUB_REPOSITORY'),
    runID: getValue(env, 'GITHUB_RUN_ID'),
    token: getValue(env, 'GITHUB_TOKEN'),
  };
}

function getValue(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = findValue(env, name);

  if (value === undefined) {
    throw new Error(`${name} must be set — the alert step passes it through env`);
  }

  return value;
}
