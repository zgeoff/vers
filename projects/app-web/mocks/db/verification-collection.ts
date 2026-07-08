import { Collection } from '@msw/data';
import { VerificationDataSchema } from '@vers/contract-verification';

export const verificationCollection = new Collection({ schema: VerificationDataSchema });
