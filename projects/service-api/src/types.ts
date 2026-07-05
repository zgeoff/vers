import type { TRPCClient } from '@trpc/client';
import type { ServiceRouter as AvatarServiceRouter } from '@vers/service-avatar';
import type { ServiceRouter as EmailServiceRouter } from '@vers/service-email';
import type { ServiceRouter as SessionServiceRouter } from '@vers/service-session';
import type { SessionData, UserData } from '@vers/service-types';
import type { ServiceRouter as UserServiceRouter } from '@vers/service-user';
import type { ServiceRouter as VerificationServiceRouter } from '@vers/service-verification';
import type { z } from 'zod';
import type { MutationErrorPayload } from '~/schema/types/mutation-error-payload';
import type { envSchema } from './env';

export type Env = z.infer<typeof envSchema>;

export interface AuthedContext {
  ipAddress: string;
  request: Request;
  requestID: string;
  services: Services;
  session: SessionData;
  user: UserData;
}

export interface UnverifiedAuthContext {
  ipAddress: string;
  request: Request;
  requestID: string;
  services: Services;
  session: SessionData;
  user: null;
}

export interface AnonymousContext {
  ipAddress: string;
  request: Request;
  requestID: string;
  services: Services;
  session: null;
  user: null;
}

export type Context = AnonymousContext | AuthedContext | UnverifiedAuthContext;

export interface Services {
  avatar: TRPCClient<AvatarServiceRouter>;
  email: TRPCClient<EmailServiceRouter>;
  session: TRPCClient<SessionServiceRouter>;
  user: TRPCClient<UserServiceRouter>;
  verification: TRPCClient<VerificationServiceRouter>;
}

export type StandardMutationPayload<T> = T | typeof MutationErrorPayload.$inferType;

export enum SecureAction {
  ChangeEmail = 'ChangeEmail',
  ChangeEmailConfirmation = 'ChangeEmailConfirmation',
  ChangePassword = 'ChangePassword',
  ForceLogout = 'ForceLogout',
  Onboarding = 'Onboarding',
  ResetPassword = 'ResetPassword',
  TwoFactorAuth = 'TwoFactorAuth',
  TwoFactorAuthDisable = 'TwoFactorAuthDisable',
  TwoFactorAuthSetup = 'TwoFactorAuthSetup',
}
