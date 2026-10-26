import { reportUnexpectedError } from '@vers/service-runtime';
import { withRootSpan } from '@vers/service-utils';
import { createEmailService } from './create-email-service';

const emailService = await createEmailService();

await emailService.queue.start();

emailService.service.logger.info('email job queue started');

// Delivers anything enqueued while the process was down; failures are pg-boss's retry/dead-letter
// problem, not boot's, so this never blocks `listen`.
void withRootSpan('email.boot-drain', async () => {
  try {
    await emailService.queue.drain();
  } catch (error) {
    emailService.service.logger.error('boot drain failed', { error });

    reportUnexpectedError(error);
  }
});

emailService.service.listen();
