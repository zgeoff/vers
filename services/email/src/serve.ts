import { createEmailService } from './create-email-service';

const emailService = await createEmailService();

await emailService.queue.start();

emailService.service.logger.info('email job queue started');

// Delivers anything enqueued while the process was down; failures are pg-boss's retry/dead-letter
// problem, not boot's, so this never blocks `listen`.
// oxlint-disable-next-line unicorn/prefer-top-level-await -- the boot drain is deliberately fire-and-forget so it never delays `listen`
void (async () => {
  try {
    await emailService.queue.drain();
  } catch (error) {
    emailService.service.logger.error({ err: error }, 'boot drain failed');
  }
})();

emailService.service.listen();
