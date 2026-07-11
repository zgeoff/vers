import { createLogger } from '@vers/service-utils';
import { createOTLPLogStream } from '@vers/service-utils/otel';
import { env } from './env';

export const logger = createLogger({
  level: env.LOGGING,
  pretty: !env.isProduction,
  ...(env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined && {
    stream: createOTLPLogStream({ serviceName: 'app-web' }),
  }),
});
