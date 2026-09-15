import { implement } from '@orpc/server';
import { emailContract } from '@vers/contract-email';
import type { EmailJobOutput } from '@vers/contract-email';
import type { JobQueue } from '@vers/jobs';
import type { ServiceContext } from '@vers/service-runtime';
import { reportUnexpectedError } from '@vers/service-runtime';
import type * as z from 'zod';
import type { EmailJobDefs } from './create-email-job-queue';
import { runRetryDrains } from './run-retry-drains';

interface BuildEmailRouterDeps {
  readonly logger: ServiceContext['logger'];
  readonly now?: () => number;
  readonly queue: JobQueue<EmailJobDefs>;
  readonly wait?: (ms: number) => Promise<void>;
}

export function buildEmailRouter(deps: BuildEmailRouterDeps) {
  const os = implement(emailContract).$context<ServiceContext>();

  return {
    sendChangeEmailNotification: os.sendChangeEmailNotification.handler(
      buildSendHandler(deps, 'send-change-email-notification'),
    ),
    sendChangeEmailVerification: os.sendChangeEmailVerification.handler(
      buildDeadlineSendHandler(deps, 'send-change-email-verification'),
    ),
    sendExistingAccount: os.sendExistingAccount.handler(
      buildSendHandler(deps, 'send-existing-account'),
    ),
    sendPasswordChanged: os.sendPasswordChanged.handler(
      buildSendHandler(deps, 'send-password-changed'),
    ),
    sendResetPassword: os.sendResetPassword.handler(buildSendHandler(deps, 'send-reset-password')),
    sendWelcome: os.sendWelcome.handler(buildDeadlineSendHandler(deps, 'send-welcome')),
  };
}

export type EmailRouter = ReturnType<typeof buildEmailRouter>;

interface SendHandlerOpts<TName extends keyof EmailJobDefs> {
  readonly input: Readonly<z.infer<EmailJobDefs[TName]['schema']>>;
}

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

type DeadlineJobName = 'send-change-email-verification' | 'send-welcome';

function buildDeadlineSendHandler<TName extends DeadlineJobName>(
  deps: BuildEmailRouterDeps,
  name: TName,
) {
  return async (opts: SendHandlerOpts<TName>): Promise<EmailJobOutput> => {
    const jobID = await deps.queue.send(name, opts.input);

    void (async () => {
      try {
        const drained = await deps.queue.drain(name);

        if (drained.failed > 0) {
          await runRetryDrains({
            drain: () => deps.queue.drain(name),
            now: deps.now ?? Date.now,
            usefulUntil: opts.input.usefulUntil,
            wait: deps.wait ?? Bun.sleep,
          });
        }
      } catch (error) {
        deps.logger.error({ err: error, jobID, queue: name }, 'email job drain failed');

        reportUnexpectedError(error);
      }
    })();

    return { jobID };
  };
}
