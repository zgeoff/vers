import { z } from 'zod';
import { readResendJSON } from './read-resend-json';
import type { ReceivedEmail } from './types';

const emailSchema = z.object({
  created_at: z.string(),
  from: z.string(),
  html: z.string().nullish(),
  id: z.string(),
  subject: z.string().nullish(),
  text: z.string().nullish(),
  to: z.array(z.string()),
});

interface GetConfig {
  readonly deadline?: number;
}

export async function readReceivedEmail(
  apiKey: string,
  id: string,
  config: GetConfig = {},
): Promise<ReceivedEmail> {
  const raw = await readResendJSON(apiKey, `/emails/receiving/${encodeURIComponent(id)}`, {
    ...(config.deadline !== undefined && { deadline: config.deadline }),
  });

  const email = emailSchema.parse(raw);

  return {
    createdAt: email.created_at,
    from: email.from,
    html: email.html ?? '',
    id: email.id,
    subject: email.subject ?? '',
    text: email.text ?? '',
    to: email.to,
  };
}
