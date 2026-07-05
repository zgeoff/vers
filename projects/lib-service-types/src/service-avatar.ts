import type { Class } from '@vers/data';

export interface AvatarData {
  class: (typeof Class)[keyof typeof Class];
  createdAt: Date;
  id: string;
  level: number;
  name: string;
  updatedAt: Date;
  userID: string;
  xp: number;
}

export type CreateAvatarPayload = AvatarData;

export interface DeleteAvatarPayload {
  deletedID: string;
}

export type GetAvatarPayload = AvatarData | null;

export type GetAvatarsPayload = Array<AvatarData>;

export interface UpdateAvatarPayload {
  updatedID: string;
}
