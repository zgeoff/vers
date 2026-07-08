import { Collection } from '@msw/data';
import { UserDataSchema } from '@vers/contract-user';

export const userCollection = new Collection({ schema: UserDataSchema });
