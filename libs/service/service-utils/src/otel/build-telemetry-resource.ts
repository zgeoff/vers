import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';

interface BuildTelemetryResourceOptions {
  readonly serviceName: string;
}

/**
 * Builds the OpenTelemetry resource shared by every exporter a process registers: the service
 * name, its version (the deployed Fly image reference when `FLY_IMAGE_REF` is set, absent
 * otherwise), and the deployment environment name from `NODE_ENV`. Passed into every exporter a
 * process registers, so every signal it exports tags the same identity.
 */
export function buildTelemetryResource(options: BuildTelemetryResourceOptions): Resource {
  const flyImageRef = process.env['FLY_IMAGE_REF'];

  return resourceFromAttributes({
    'deployment.environment.name': process.env.NODE_ENV ?? 'development',
    'service.name': options.serviceName,
    ...(flyImageRef !== undefined && { 'service.version': flyImageRef }),
  });
}
