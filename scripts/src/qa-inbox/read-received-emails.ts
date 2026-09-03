import { z } from 'zod';
import { readResendJSON } from './read-resend-json';
import type { ReceivedEmailSummary } from './types';

const summarySchema = z.object({
  created_at: z.string(),
  from: z.string(),
  id: z.string(),
  subject: z.string().nullish(),
  to: z.array(z.string()),
});

const listSchema = z.object({ data: z.array(summarySchema) });

interface ListConfig {
  readonly limit: number;
}

export async function readReceivedEmails(
  apiKey: string,
  config: ListConfig,
): Promise<Array<ReceivedEmailSummary>> {
  const raw = await readResendJSON(apiKey, `/emails/receiving?limit=${config.limit}`);

  return listSchema.parse(raw).data.map((email) => ({
    createdAt: email.created_at,
    from: email.from,
    id: email.id,
    subject: email.subject ?? '',
    to: email.to,
  }));
}
