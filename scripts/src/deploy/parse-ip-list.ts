import { z } from 'zod';
import type { AppIP } from './types';

const ipRecordSchema = z.object({ Address: z.string(), Type: z.string() }).readonly();

const ipListSchema = z
  .array(ipRecordSchema)
  .nullable()
  .transform((records) => records ?? []);

const PRIVATE_IP_TYPE = 'private_v6';

/**
 * Parses `flyctl ips list --json` output into the exposure the IP-posture planner reasons about.
 * `private_v6` is the only flycast-ingress type Fly reports; every other value — `v6`,
 * `shared_v4`, `v4`, or one this hasn't seen yet — is public, so an unrecognized future type fails
 * toward reporting a posture violation rather than missing one. A `null` document counts as an
 * empty list — Go marshals a nil slice as `null`, and an app can hold zero allocated addresses.
 */
export function parseIPList(json: unknown): ReadonlyArray<AppIP> {
  const records = ipListSchema.parse(json);

  return records.map((record) => ({
    address: record.Address,
    type: record.Type === PRIVATE_IP_TYPE ? 'private' : 'public',
  }));
}
