import { Collection } from '@msw/data';
import { VerificationDataSchema } from '@vers/contract-verification';

/** In-memory verification store backing the mock verification service. */
export const verificationCollection = new Collection({ schema: VerificationDataSchema });
