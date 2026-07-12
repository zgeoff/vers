import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

export {
  ENDPOINT_URL as RESEND_ENDPOINT_URL,
  resolveResendEmails,
  sentEmails,
} from './handlers/http/resend-emails';

export type { CapturedEmail } from './handlers/http/resend-emails';
