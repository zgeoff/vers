import { implement } from '@orpc/server';
import { emailContract } from '@vers/contract-email';
import type { EmailJobOutput } from '@vers/contract-email';
import type { JobQueue } from '@vers/jobs';
import type { ServiceContext } from '@vers/service-runtime';
import { reportUnexpectedError } from '@vers/service-runtime';
import type { BackgroundDrains } from './create-background-drains';
import type { EmailJobPayloads } from './create-email-job-queue';
import { runRetryDrains } from './run-retry-drains';

interface BuildEmailRouterDeps {
  readonly drains: BackgroundDrains;
  readonly logger: ServiceContext['logger'];
  readonly now?: () => number;
  readonly queue: JobQueue<EmailJobPayloads>;
  readonly wait?: (delayMs: number) => Promise<void>;
}

export function buildEmailRouter(deps: BuildEmailRouterDeps) {
  const os = implement(emailContract).$context<ServiceContext>();

  return {
    sendChangeEmailNotification: os.sendChangeEmailNotification.handler(
      makeSendHandler(deps, 'send-change-email-notification'),
    ),
    sendChangeEmailVerification: os.sendChangeEmailVerification.handler(
      makeDeadlineSendHandler(deps, 'send-change-email-verification'),
    ),
    sendExistingAccount: os.sendExistingAccount.handler(
      makeSendHandler(deps, 'send-existing-account'),
    ),
    sendPasswordChanged: os.sendPasswordChanged.handler(
      makeSendHandler(deps, 'send-password-changed'),
    ),
    sendResetPassword: os.sendResetPassword.handler(makeSendHandler(deps, 'send-reset-password')),
    sendWelcome: os.sendWelcome.handler(makeDeadlineSendHandler(deps, 'send-welcome')),
  };
}

export type EmailRouter = ReturnType<typeof buildEmailRouter>;

interface SendHandlerOpts<TName extends keyof EmailJobPayloads> {
  readonly input: Readonly<EmailJobPayloads[TName]>;
}

function makeSendHandler<TName extends keyof EmailJobPayloads>(
  deps: BuildEmailRouterDeps,
  name: TName,
) {
  return async (opts: SendHandlerOpts<TName>): Promise<EmailJobOutput> => {
    const jobID = await deps.queue.send(name, opts.input);

    if (deps.drains.signal.aborted) {
      return { jobID };
    }

    void (async () => {
      try {
        await deps.drains.track(deps.queue.drain(name));
      } catch (error) {
        deps.logger.error('email job drain failed', { error, jobID, queue: name });

        reportUnexpectedError(error);
      }
    })();

    return { jobID };
  };
}

type DeadlineJobName = 'send-change-email-verification' | 'send-welcome';

function makeDeadlineSendHandler<TName extends DeadlineJobName>(
  deps: BuildEmailRouterDeps,
  name: TName,
) {
  return async (opts: SendHandlerOpts<TName>): Promise<EmailJobOutput> => {
    const jobID = await deps.queue.send(name, opts.input);

    if (deps.drains.signal.aborted) {
      return { jobID };
    }

    void (async () => {
      try {
        await deps.drains.track(deps.queue.drain(name));

        // Watch this job whatever this drain reported: a concurrent request's drain can claim
        // and fail it while this one fails none.
        await runRetryDrains({
          drain: () => deps.drains.track(deps.queue.drain(name)),
          readState: () => deps.drains.track(deps.queue.readJobState(name, jobID)),
          now: deps.now ?? Date.now,
          signal: deps.drains.signal,
          usefulUntil: opts.input.usefulUntil,
          wait: deps.wait ?? Bun.sleep,
        });
      } catch (error) {
        deps.logger.error('email job drain failed', { error, jobID, queue: name });

        reportUnexpectedError(error);
      }
    })();

    return { jobID };
  };
}
