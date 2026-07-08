import { Collection } from '@msw/data';
import { AvatarDataSchema } from '@vers/contract-avatar';

export const avatarCollection = new Collection({ schema: AvatarDataSchema });
