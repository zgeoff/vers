import { z } from 'zod';
import { buildDiscordAlert } from './build-discord-alert';

type AlertOutcome = 'sent' | 'no-webhook';

// a workflow passes an unset secret or optional value as an empty string
const optionalValueSchema = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const alertEnvSchema = z.object({
  WEBHOOK_URL: optionalValueSchema,
  RUN_URL: z.string().min(1),
  ALERT_TITLE: z.string().min(1),
  ALERT_DESCRIPTION: z.string(),
  ALERT_FAILED_JOBS: optionalValueSchema,
});

export async function writeDiscordAlert(
  env: Readonly<Record<string, string | undefined>>,
): Promise<AlertOutcome> {
  const values = alertEnvSchema.parse(env);

  if (values.WEBHOOK_URL === undefined) {
    return 'no-webhook';
  }

  const body = buildDiscordAlert({
    title: values.ALERT_TITLE,
    runURL: values.RUN_URL,
    description: values.ALERT_DESCRIPTION,
    failedJobs: values.ALERT_FAILED_JOBS,
  });

  const response = await fetch(values.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`the Discord webhook answered ${response.status}: ${await response.text()}`);
  }

  return 'sent';
}
