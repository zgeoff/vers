import { Collection } from '@msw/data';
import { SessionDataSchema } from '@vers/contract-session';

/** In-memory session store backing the mock session service; schema mirrors the contract's output. */
export const sessionCollection = new Collection({ schema: SessionDataSchema });
