import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { AvatarDataSchema } from './avatar-data-schema';
import { AvatarNameSchema } from './avatar-name-schema';

/**
 * The avatar service's API: every procedure is authed and owner-scoped by `actingUserId`.
 */
export const avatarContract = {
  createAvatar: authedRoute
    .route({ method: 'POST', path: '/avatars', summary: 'Create an avatar for the caller' })
    .input(z.object({ name: AvatarNameSchema }))
    .output(AvatarDataSchema)
    .errors(
      defineErrors({
        CONFLICT: { data: z.object({}), message: 'An avatar with that name already exists' },
      }),
    ),

  deleteAvatar: authedRoute
    .route({
      method: 'DELETE',
      path: '/avatars/{id}',
      summary: 'Delete an avatar owned by the caller',
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deletedID: z.string() }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
      }),
    ),

  getAvatar: authedRoute
    .route({ method: 'GET', path: '/avatars/{id}', summary: 'Get an avatar owned by the caller' })
    .input(z.object({ id: z.string() }))
    .output(AvatarDataSchema.nullable()),

  getAvatars: authedRoute
    .route({ method: 'GET', path: '/avatars', summary: 'List avatars owned by the caller' })
    .input(z.object({}))
    .output(z.array(AvatarDataSchema)),

  /**
   * `name` is the only user-editable field by design: `level`/`xp` are server-owned progression.
   * The input shape is frozen with #255 — do not widen it.
   */
  updateAvatar: authedRoute
    .route({
      method: 'PATCH',
      path: '/avatars/{id}',
      summary: 'Update an avatar owned by the caller',
    })
    .input(z.object({ id: z.string(), name: AvatarNameSchema }))
    .output(z.object({ updatedID: z.string() }))
    .errors(
      defineErrors({
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
      }),
    ),
};

export type AvatarContract = typeof avatarContract;
