import { flushErrorReports, reportUnexpectedError } from '@vers/service-runtime';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import type { ReplayService } from './create-replay-service';

type ScheduledDrainService = Pick<ReplayService, 'drain' | 'logger' | 'stop'>;

export async function runScheduledDrain(service: ScheduledDrainService): Promise<number> {
  const drainExitCode = await withTraceContext(createTraceContext(), () => runTracedDrain(service));

  // a teardown fault is reported too, and the flush runs whatever the teardown did
  const teardownExitCode = await service.stop().then(
    () => 0,
    (error: unknown) => {
      service.logger.error('teardown failed after the scheduled drain', { error });

      reportUnexpectedError(error);

      return 1;
    },
  );

  const flushed = await flushErrorReports();

  if (!flushed) {
    service.logger.warn('error reports were still queued when the flush timed out');
  }

  return drainExitCode === 0 ? teardownExitCode : drainExitCode;
}

// the try/catch lives inside the trace scope so a drain failure report still carries its trace id
async function runTracedDrain(service: ScheduledDrainService): Promise<number> {
  try {
    const drained = await service.drain('schedule');

    service.logger.info('drained the replay queue on schedule', { drained });

    return 0;
  } catch (error) {
    service.logger.error('scheduled replay drain failed', { error });

    reportUnexpectedError(error);

    return 1;
  }
}
