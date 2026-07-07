import { Collection } from '@msw/data';
import { UserDataSchema } from '@vers/contract-user';

/** In-memory user store backing the mock user service; schema mirrors the contract's own output. */
export const userCollection = new Collection({ schema: UserDataSchema });
