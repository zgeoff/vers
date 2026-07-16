import { implement } from '@orpc/server';
import { emailContract } from '@vers/contract-email';
import type { EmailJobOutput } from '@vers/contract-email';
import type { JobQueue } from '@vers/jobs';
import type { ServiceContext } from '@vers/service-runtime';
import { reportUnexpectedError } from '@vers/service-runtime';
import type * as z from 'zod';
import type { EmailJobDefs } from './create-email-job-queue';

interface BuildEmailRouterDeps {
  readonly logger: ServiceContext['logger'];
  readonly queue: JobQueue<EmailJobDefs>;
}

/**
 * Assembles the email service's oRPC router: every procedure enqueues its job and returns
 * immediately, closing over the shared queue and logger.
 */
export function buildEmailRouter(deps: BuildEmailRouterDeps) {
  const os = implement(emailContract).$context<ServiceContext>();

  return {
    sendChangeEmailNotification: os.sendChangeEmailNotification.handler(
      buildSendHandler(deps, 'send-change-email-notification'),
    ),
    sendChangeEmailVerification: os.sendChangeEmailVerification.handler(
      buildSendHandler(deps, 'send-change-email-verification'),
    ),
    sendExistingAccount: os.sendExistingAccount.handler(
      buildSendHandler(deps, 'send-existing-account'),
    ),
    sendPasswordChanged: os.sendPasswordChanged.handler(
      buildSendHandler(deps, 'send-password-changed'),
    ),
    sendResetPassword: os.sendResetPassword.handler(buildSendHandler(deps, 'send-reset-password')),
    sendWelcome: os.sendWelcome.handler(buildSendHandler(deps, 'send-welcome')),
  };
}

export type EmailRouter = ReturnType<typeof buildEmailRouter>;

interface SendHandlerOpts<TName extends keyof EmailJobDefs> {
  readonly input: Readonly<z.infer<EmailJobDefs[TName]['schema']>>;
}

/**
 * Builds one procedure's handler: enqueues its payload under `name`, then nudges delivery without
 * gating the response — a fire-and-forget drain whose failures are pg-boss's retry/dead-letter
 * problem, not this request's. The detached drain starts inside the request's own trace scope, so
 * a report it makes still carries the originating request's trace id.
 */
function buildSendHandler<TName extends keyof EmailJobDefs>(
  deps: BuildEmailRouterDeps,
  name: TName,
) {
  return async (opts: SendHandlerOpts<TName>): Promise<EmailJobOutput> => {
    const jobID = await deps.queue.send(name, opts.input);

    void (async () => {
      try {
        await deps.queue.drain(name);
      } catch (error) {
        deps.logger.error({ err: error, jobID, queue: name }, 'email job drain failed');

        reportUnexpectedError(error);
      }
    })();

    return { jobID };
  };
}
