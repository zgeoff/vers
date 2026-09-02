import { authedRoute, defineErrors } from '@vers/contract-base';
import * as z from 'zod';
import { AvatarDataSchema } from './avatar-data-schema';
import { AvatarModeSchema } from './avatar-mode-schema';
import { AvatarNameSchema } from './avatar-name-schema';
import { AvatarRosterSchema } from './avatar-roster-schema';

const LimitReachedDataSchema = z.object({ cap: z.int(), mode: AvatarModeSchema });

const SwitchLockedDataSchema = z.object({
  owningAvatarID: z.string(),
  owningAvatarName: z.string(),
});

/**
 * The avatar service's API: every procedure is authed and owner-scoped by `actingUserID`.
 */
export const avatarContract = {
  createAvatar: authedRoute
    .route({ method: 'POST', path: '/avatars', summary: 'Create an avatar for the caller' })
    .input(z.object({ mode: AvatarModeSchema.default('trade'), name: AvatarNameSchema }))
    .output(AvatarDataSchema)
    .errors(
      defineErrors({
        CONFLICT: { data: z.object({}), message: 'An avatar with that name already exists' },
        LIMIT_REACHED: {
          data: LimitReachedDataSchema,
          message: 'The avatar limit for this mode is reached',
          status: 409,
        },
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
    .route({
      method: 'GET',
      path: '/avatars',
      summary: 'List avatars owned by the caller with the active selection',
    })
    .input(z.object({}))
    .output(AvatarRosterSchema),

  selectAvatar: authedRoute
    .route({
      method: 'POST',
      path: '/avatars/{id}/select',
      summary: 'Make an avatar owned by the caller the active one',
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ activeAvatarID: z.string() }))
    .errors(
      defineErrors({
        CONFLICT: {
          data: SwitchLockedDataSchema,
          message: 'A live activity holds the active avatar',
        },
        NOT_FOUND: { data: z.object({}), message: 'Avatar not found' },
      }),
    ),

  /**
   * `name` is the only user-editable field by design: `level`/`xp` are server-owned progression.
   * The input shape is intentionally minimal — do not widen it.
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
