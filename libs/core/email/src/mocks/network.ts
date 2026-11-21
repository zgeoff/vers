import { createTestNetwork } from '@zgeoff/testing/fetch';
import { handlers } from './handlers';

export const network = createTestNetwork({ handlers });

export {
  ENDPOINT_URL as RESEND_ENDPOINT_URL,
  resolveResendEmails,
  sentEmails,
} from './handlers/http/resend-emails';

export type { CapturedEmail } from './handlers/http/resend-emails';
