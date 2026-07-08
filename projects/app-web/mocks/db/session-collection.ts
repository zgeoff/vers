import { Collection } from '@msw/data';
import { SessionDataSchema } from '@vers/contract-session';

export const sessionCollection = new Collection({ schema: SessionDataSchema });
