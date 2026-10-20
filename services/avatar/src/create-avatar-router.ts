import { implement } from '@orpc/server';
import { avatarContract } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createAvatar } from './handlers/create-avatar';
import { readAvatar } from './handlers/read-avatar';
import { readAvatars } from './handlers/read-avatars';
import { removeAvatar } from './handlers/remove-avatar';
import { selectAvatar } from './handlers/select-avatar';
import { updateAvatar } from './handlers/update-avatar';

interface CreateAvatarRouterDeps {
  readonly db: Kysely<DB>;
}

export function createAvatarRouter(deps: CreateAvatarRouterDeps) {
  const os = implement(avatarContract).$context<ServiceContext>();

  return {
    createAvatar: os.createAvatar.handler((opts) => createAvatar(deps.db, opts)),
    deleteAvatar: os.deleteAvatar.handler((opts) => removeAvatar(deps.db, opts)),
    getAvatar: os.getAvatar.handler((opts) => readAvatar(deps.db, opts)),
    getAvatars: os.getAvatars.handler((opts) => readAvatars(deps.db, opts)),
    selectAvatar: os.selectAvatar.handler((opts) => selectAvatar(deps.db, opts)),
    updateAvatar: os.updateAvatar.handler((opts) => updateAvatar(deps.db, opts)),
  };
}

export type AvatarRouter = ReturnType<typeof createAvatarRouter>;
