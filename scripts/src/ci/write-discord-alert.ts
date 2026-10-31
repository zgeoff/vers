import { buildDiscordAlert } from './build-discord-alert';

type AlertOutcome = 'sent' | 'no-webhook';

// The alert imports no package, so it runs after a failed `bun install` and reports that failure.
export async function writeDiscordAlert(
  env: Readonly<Record<string, string | undefined>>,
): Promise<AlertOutcome> {
  const webhookURL = findValue(env, 'WEBHOOK_URL');

  if (webhookURL === undefined) {
    return 'no-webhook';
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

function getValue(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = findValue(env, name);

  if (value === undefined) {
    throw new Error(`${name} must be set — the alert step passes it through env`);
  }

  return value;
}
