import { z } from 'zod';
import type { AppIP } from './types';

const ipRecordSchema = z.object({ Address: z.string(), Type: z.string() }).readonly();

// a null document is an empty list: Go marshals a nil slice as null
const ipListSchema = z
  .array(ipRecordSchema)
  .nullable()
  .transform((records) => records ?? []);

// private_v6 is the only flycast-ingress type Fly reports; every other type, including one not
// yet seen, is public, so an unknown type fails toward reporting a posture violation
const PRIVATE_IP_TYPE = 'private_v6';

export function parseIPList(json: unknown): ReadonlyArray<AppIP> {
  const records = ipListSchema.parse(json);

  return records.map((record) => ({
    address: record.Address,
    type: record.Type === PRIVATE_IP_TYPE ? 'private' : 'public',
  }));
}
