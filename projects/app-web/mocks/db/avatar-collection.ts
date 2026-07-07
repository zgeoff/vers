import { Collection } from '@msw/data';
import { AvatarDataSchema } from '@vers/contract-avatar';

/** In-memory avatar store backing the mock avatar service. */
export const avatarCollection = new Collection({ schema: AvatarDataSchema });
