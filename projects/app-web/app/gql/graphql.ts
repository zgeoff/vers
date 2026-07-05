/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  /** The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID. */
  ID: { input: string; output: string; }
  /** The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text. */
  String: { input: string; output: string; }
  /** The `Boolean` scalar type represents `true` or `false`. */
  Boolean: { input: boolean; output: boolean; }
  /** The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1. */
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date string, such as 2007-12-03, compliant with the `full-date` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  Date: { input: Date; output: string; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: { input: Date; output: string; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  session: Session;
};

export type Avatar = {
  __typename?: 'Avatar';
  class: AvatarClass;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  user: User;
  xp: Scalars['Int']['output'];
};

export enum AvatarClass {
  Brute = 'Brute',
  Scholar = 'Scholar',
  Scoundrel = 'Scoundrel'
}

export type ChangeUserPasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
  transactionToken?: InputMaybe<Scalars['String']['input']>;
};

export type ChangeUserPasswordPayload = MutationErrorPayload | MutationSuccess;

export type CreateAvatarInput = {
  class: AvatarClass;
  name: Scalars['String']['input'];
};

export type CreateAvatarPayload = Avatar | MutationErrorPayload;

export type DeleteAvatarInput = {
  id: Scalars['String']['input'];
};

export type DeleteAvatarPayload = MutationErrorPayload | MutationSuccess;

export type DeleteSessionInput = {
  id: Scalars['String']['input'];
};

export type DeleteSessionPayload = MutationErrorPayload | MutationSuccess;

export type FinishChangeUserEmailInput = {
  email: Scalars['String']['input'];
  transactionToken: Scalars['String']['input'];
};

export type FinishChangeUserEmailPayload = MutationErrorPayload | MutationSuccess;

export type FinishDisable2FaInput = {
  transactionToken: Scalars['String']['input'];
};

export type FinishDisable2FaPayload = MutationErrorPayload | MutationSuccess;

export type FinishEmailSignupInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  rememberMe: Scalars['Boolean']['input'];
  transactionToken: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type FinishEmailSignupPayload = AuthPayload | MutationErrorPayload;

export type FinishEnable2FaInput = {
  transactionToken: Scalars['String']['input'];
};

export type FinishEnable2FaPayload = MutationErrorPayload | MutationSuccess;

export type FinishLoginWith2FaInput = {
  target: Scalars['String']['input'];
  transactionToken: Scalars['String']['input'];
};

export type FinishLoginWith2FaPayload = AuthPayload | ForceLogoutPayload | MutationErrorPayload;

export type FinishPasswordResetInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  resetToken: Scalars['String']['input'];
  transactionToken?: InputMaybe<Scalars['String']['input']>;
};

export type FinishPasswordResetPayload = MutationErrorPayload | MutationSuccess;

export type ForceLogoutPayload = {
  __typename?: 'ForceLogoutPayload';
  sessionID: Scalars['String']['output'];
  transactionToken: Scalars['String']['output'];
};

export type GetAvatarInput = {
  id: Scalars['String']['input'];
};

export type GetAvatarsInput = {
  placeholder?: InputMaybe<Scalars['String']['input']>;
};

export type GetSessionsInput = {
  placeholder?: InputMaybe<Scalars['String']['input']>;
};

export type LoginWithForcedLogoutInput = {
  target: Scalars['String']['input'];
  transactionToken: Scalars['String']['input'];
};

export type LoginWithForcedLogoutPayload = AuthPayload | MutationErrorPayload;

export type LoginWithPasswordInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  rememberMe: Scalars['Boolean']['input'];
};

export type LoginWithPasswordPayload = AuthPayload | ForceLogoutPayload | MutationErrorPayload | TwoFactorLoginPayload;

export type Mutation = {
  __typename?: 'Mutation';
  changeUserPassword: ChangeUserPasswordPayload;
  createAvatar: CreateAvatarPayload;
  deleteAvatar: DeleteAvatarPayload;
  deleteSession: DeleteSessionPayload;
  finishChangeUserEmail: FinishChangeUserEmailPayload;
  finishDisable2FA: FinishDisable2FaPayload;
  finishEmailSignup: FinishEmailSignupPayload;
  finishEnable2FA: FinishEnable2FaPayload;
  finishLoginWith2FA: FinishLoginWith2FaPayload;
  finishPasswordReset: FinishPasswordResetPayload;
  loginWithForcedLogout: LoginWithForcedLogoutPayload;
  loginWithPassword: LoginWithPasswordPayload;
  refreshAccessToken: RefreshAccessTokenPayload;
  startChangeUserEmail: StartChangeUserEmailPayload;
  startEmailSignup: StartEmailSignupPayload;
  startEnable2FA: StartEnable2FaPayload;
  startPasswordReset: StartPasswordResetPayload;
  startStepUpAuth: StartStepUpAuthPayload;
  updateAvatar: UpdateAvatarPayload;
  verifyOTP: VerifyOtpPayload;
};


export type MutationChangeUserPasswordArgs = {
  input: ChangeUserPasswordInput;
};


export type MutationCreateAvatarArgs = {
  input: CreateAvatarInput;
};


export type MutationDeleteAvatarArgs = {
  input: DeleteAvatarInput;
};


export type MutationDeleteSessionArgs = {
  input: DeleteSessionInput;
};


export type MutationFinishChangeUserEmailArgs = {
  input: FinishChangeUserEmailInput;
};


export type MutationFinishDisable2FaArgs = {
  input: FinishDisable2FaInput;
};


export type MutationFinishEmailSignupArgs = {
  input: FinishEmailSignupInput;
};


export type MutationFinishEnable2FaArgs = {
  input: FinishEnable2FaInput;
};


export type MutationFinishLoginWith2FaArgs = {
  input: FinishLoginWith2FaInput;
};


export type MutationFinishPasswordResetArgs = {
  input: FinishPasswordResetInput;
};


export type MutationLoginWithForcedLogoutArgs = {
  input: LoginWithForcedLogoutInput;
};


export type MutationLoginWithPasswordArgs = {
  input: LoginWithPasswordInput;
};


export type MutationRefreshAccessTokenArgs = {
  input: RefreshAccessTokenInput;
};


export type MutationStartChangeUserEmailArgs = {
  input: StartChangeUserEmailInput;
};


export type MutationStartEmailSignupArgs = {
  input: StartEmailSignupInput;
};


export type MutationStartEnable2FaArgs = {
  input: StartEnable2FaInput;
};


export type MutationStartPasswordResetArgs = {
  input: StartPasswordResetInput;
};


export type MutationStartStepUpAuthArgs = {
  input: StartStepUpAuthInput;
};


export type MutationUpdateAvatarArgs = {
  input: UpdateAvatarInput;
};


export type MutationVerifyOtpArgs = {
  input: VerifyOtpInput;
};

export type MutationError = {
  __typename?: 'MutationError';
  message: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type MutationErrorPayload = {
  __typename?: 'MutationErrorPayload';
  error: MutationError;
};

export type MutationSuccess = {
  __typename?: 'MutationSuccess';
  success: Scalars['Boolean']['output'];
};

export type Query = {
  __typename?: 'Query';
  getAvatar?: Maybe<Avatar>;
  getAvatars: Array<Avatar>;
  getCurrentUser: User;
  getEnable2FAVerification: TwoFactorVerification;
  getSessions: Array<Session>;
};


export type QueryGetAvatarArgs = {
  input: GetAvatarInput;
};


export type QueryGetAvatarsArgs = {
  input: GetAvatarsInput;
};


export type QueryGetSessionsArgs = {
  input: GetSessionsInput;
};

export type RefreshAccessTokenInput = {
  refreshToken: Scalars['String']['input'];
};

export type RefreshAccessTokenPayload = MutationErrorPayload | TokenPayload;

export type Session = {
  __typename?: 'Session';
  createdAt: Scalars['DateTime']['output'];
  expiresAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  user: User;
};

export type StartChangeUserEmailInput = {
  email: Scalars['String']['input'];
  transactionToken?: InputMaybe<Scalars['String']['input']>;
};

export type StartChangeUserEmailPayload = MutationErrorPayload | VerificationRequiredPayload;

export type StartEmailSignupInput = {
  email: Scalars['String']['input'];
};

export type StartEmailSignupPayload = MutationErrorPayload | VerificationRequiredPayload;

export type StartEnable2FaInput = {
  placeholder?: InputMaybe<Scalars['String']['input']>;
};

export type StartEnable2FaPayload = MutationErrorPayload | VerificationRequiredPayload;

export type StartPasswordResetInput = {
  email: Scalars['String']['input'];
};

export type StartPasswordResetPayload = MutationErrorPayload | MutationSuccess | VerificationRequiredPayload;

export type StartStepUpAuthInput = {
  action: StepUpAction;
};

export type StartStepUpAuthPayload = MutationErrorPayload | VerificationRequiredPayload;

export enum StepUpAction {
  ChangeEmail = 'CHANGE_EMAIL',
  ChangePassword = 'CHANGE_PASSWORD',
  Disable_2Fa = 'DISABLE_2FA'
}

export type TokenPayload = {
  __typename?: 'TokenPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
};

export type TwoFactorLoginPayload = {
  __typename?: 'TwoFactorLoginPayload';
  sessionID: Scalars['String']['output'];
  transactionID: Scalars['String']['output'];
};

export type TwoFactorSuccessPayload = {
  __typename?: 'TwoFactorSuccessPayload';
  transactionToken: Scalars['String']['output'];
};

export type TwoFactorVerification = {
  __typename?: 'TwoFactorVerification';
  otpURI: Scalars['String']['output'];
};

export type UpdateAvatarInput = {
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type UpdateAvatarPayload = MutationErrorPayload | MutationSuccess;

export type User = {
  __typename?: 'User';
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  is2FAEnabled: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  username: Scalars['String']['output'];
};

export type VerificationRequiredPayload = {
  __typename?: 'VerificationRequiredPayload';
  transactionID: Scalars['String']['output'];
};

export enum VerificationType {
  ChangeEmail = 'CHANGE_EMAIL',
  ChangeEmailConfirmation = 'CHANGE_EMAIL_CONFIRMATION',
  ChangePassword = 'CHANGE_PASSWORD',
  Onboarding = 'ONBOARDING',
  ResetPassword = 'RESET_PASSWORD',
  TwoFactorAuth = 'TWO_FACTOR_AUTH',
  TwoFactorAuthDisable = 'TWO_FACTOR_AUTH_DISABLE',
  TwoFactorAuthSetup = 'TWO_FACTOR_AUTH_SETUP'
}

export type VerifyOtpInput = {
  code: Scalars['String']['input'];
  sessionID?: InputMaybe<Scalars['String']['input']>;
  target: Scalars['String']['input'];
  transactionID: Scalars['String']['input'];
  type: VerificationType;
};

export type VerifyOtpPayload = MutationErrorPayload | TwoFactorSuccessPayload;

export type ChangeUserPasswordMutationVariables = Exact<{
  input: ChangeUserPasswordInput;
}>;


export type ChangeUserPasswordMutation = { __typename?: 'Mutation', changeUserPassword: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type CreateAvatarMutationVariables = Exact<{
  input: CreateAvatarInput;
}>;


export type CreateAvatarMutation = { __typename?: 'Mutation', createAvatar: { __typename?: 'Avatar', id: string } | { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } };

export type DeleteSessionMutationVariables = Exact<{
  input: DeleteSessionInput;
}>;


export type DeleteSessionMutation = { __typename?: 'Mutation', deleteSession: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type FinishChangeUserEmailMutationVariables = Exact<{
  input: FinishChangeUserEmailInput;
}>;


export type FinishChangeUserEmailMutation = { __typename?: 'Mutation', finishChangeUserEmail: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type FinishDisable2FaMutationVariables = Exact<{
  input: FinishDisable2FaInput;
}>;


export type FinishDisable2FaMutation = { __typename?: 'Mutation', finishDisable2FA: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type FinishEmailSignupMutationVariables = Exact<{
  input: FinishEmailSignupInput;
}>;


export type FinishEmailSignupMutation = { __typename?: 'Mutation', finishEmailSignup: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, session: { __typename?: 'Session', id: string, expiresAt: string } } | { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } };

export type FinishEnable2FaMutationVariables = Exact<{
  input: FinishEnable2FaInput;
}>;


export type FinishEnable2FaMutation = { __typename?: 'Mutation', finishEnable2FA: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type FinishLoginWith2FaMutationVariables = Exact<{
  input: FinishLoginWith2FaInput;
}>;


export type FinishLoginWith2FaMutation = { __typename?: 'Mutation', finishLoginWith2FA: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, session: { __typename?: 'Session', id: string, expiresAt: string } } | { __typename?: 'ForceLogoutPayload', sessionID: string, transactionToken: string } | { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } };

export type FinishPasswordResetMutationVariables = Exact<{
  input: FinishPasswordResetInput;
}>;


export type FinishPasswordResetMutation = { __typename?: 'Mutation', finishPasswordReset: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } };

export type LoginWithForcedLogoutMutationVariables = Exact<{
  input: LoginWithForcedLogoutInput;
}>;


export type LoginWithForcedLogoutMutation = { __typename?: 'Mutation', loginWithForcedLogout: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, session: { __typename?: 'Session', id: string, expiresAt: string } } | { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } };

export type LoginWithPasswordMutationVariables = Exact<{
  input: LoginWithPasswordInput;
}>;


export type LoginWithPasswordMutation = { __typename?: 'Mutation', loginWithPassword: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, session: { __typename?: 'Session', id: string, expiresAt: string } } | { __typename?: 'ForceLogoutPayload', sessionID: string, transactionToken: string } | { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'TwoFactorLoginPayload', transactionID: string, sessionID: string } };

export type RefreshAccessTokenMutationVariables = Exact<{
  input: RefreshAccessTokenInput;
}>;


export type RefreshAccessTokenMutation = { __typename?: 'Mutation', refreshAccessToken: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'TokenPayload', accessToken: string, refreshToken: string } };

export type StartChangeUserEmailMutationVariables = Exact<{
  input: StartChangeUserEmailInput;
}>;


export type StartChangeUserEmailMutation = { __typename?: 'Mutation', startChangeUserEmail: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'VerificationRequiredPayload', transactionID: string } };

export type StartEmailSignupMutationVariables = Exact<{
  input: StartEmailSignupInput;
}>;


export type StartEmailSignupMutation = { __typename?: 'Mutation', startEmailSignup: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'VerificationRequiredPayload', transactionID: string } };

export type StartEnable2FaMutationVariables = Exact<{
  input: StartEnable2FaInput;
}>;


export type StartEnable2FaMutation = { __typename?: 'Mutation', startEnable2FA: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'VerificationRequiredPayload', transactionID: string } };

export type StartPasswordResetMutationVariables = Exact<{
  input: StartPasswordResetInput;
}>;


export type StartPasswordResetMutation = { __typename?: 'Mutation', startPasswordReset: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'MutationSuccess', success: boolean } | { __typename?: 'VerificationRequiredPayload', transactionID: string } };

export type StartStepUpAuthMutationVariables = Exact<{
  input: StartStepUpAuthInput;
}>;


export type StartStepUpAuthMutation = { __typename?: 'Mutation', startStepUpAuth: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'VerificationRequiredPayload', transactionID: string } };

export type VerifyOtpMutationVariables = Exact<{
  input: VerifyOtpInput;
}>;


export type VerifyOtpMutation = { __typename?: 'Mutation', verifyOTP: { __typename?: 'MutationErrorPayload', error: { __typename?: 'MutationError', title: string, message: string } } | { __typename?: 'TwoFactorSuccessPayload', transactionToken: string } };

export type GetAvatarsQueryVariables = Exact<{
  input: GetAvatarsInput;
}>;


export type GetAvatarsQuery = { __typename?: 'Query', getAvatars: Array<{ __typename?: 'Avatar', id: string, name: string, class: AvatarClass, level: number, xp: number, createdAt: string }> };

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentUserQuery = { __typename?: 'Query', getCurrentUser: { __typename?: 'User', id: string, username: string, name: string, email: string, is2FAEnabled: boolean } };

export type GetEnable2FaVerificationQueryVariables = Exact<{ [key: string]: never; }>;


export type GetEnable2FaVerificationQuery = { __typename?: 'Query', getEnable2FAVerification: { __typename?: 'TwoFactorVerification', otpURI: string } };


export const ChangeUserPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeUserPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChangeUserPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeUserPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ChangeUserPasswordMutation, ChangeUserPasswordMutationVariables>;
export const CreateAvatarDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateAvatar"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAvatarInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAvatar"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Avatar"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateAvatarMutation, CreateAvatarMutationVariables>;
export const DeleteSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteSessionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const FinishChangeUserEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishChangeUserEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishChangeUserEmailInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishChangeUserEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishChangeUserEmailMutation, FinishChangeUserEmailMutationVariables>;
export const FinishDisable2FaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishDisable2FA"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishDisable2FAInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishDisable2FA"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishDisable2FaMutation, FinishDisable2FaMutationVariables>;
export const FinishEmailSignupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishEmailSignup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishEmailSignupInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishEmailSignup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AuthPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishEmailSignupMutation, FinishEmailSignupMutationVariables>;
export const FinishEnable2FaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishEnable2FA"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishEnable2FAInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishEnable2FA"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishEnable2FaMutation, FinishEnable2FaMutationVariables>;
export const FinishLoginWith2FaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishLoginWith2FA"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishLoginWith2FAInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishLoginWith2FA"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AuthPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ForceLogoutPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionID"}},{"kind":"Field","name":{"kind":"Name","value":"transactionToken"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishLoginWith2FaMutation, FinishLoginWith2FaMutationVariables>;
export const FinishPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinishPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FinishPasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finishPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<FinishPasswordResetMutation, FinishPasswordResetMutationVariables>;
export const LoginWithForcedLogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginWithForcedLogout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginWithForcedLogoutInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginWithForcedLogout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AuthPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LoginWithForcedLogoutMutation, LoginWithForcedLogoutMutationVariables>;
export const LoginWithPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginWithPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginWithPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginWithPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AuthPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}},{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TwoFactorLoginPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}},{"kind":"Field","name":{"kind":"Name","value":"sessionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ForceLogoutPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionID"}},{"kind":"Field","name":{"kind":"Name","value":"transactionToken"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LoginWithPasswordMutation, LoginWithPasswordMutationVariables>;
export const RefreshAccessTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshAccessToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RefreshAccessTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshAccessToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TokenPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<RefreshAccessTokenMutation, RefreshAccessTokenMutationVariables>;
export const StartChangeUserEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartChangeUserEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartChangeUserEmailInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startChangeUserEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VerificationRequiredPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StartChangeUserEmailMutation, StartChangeUserEmailMutationVariables>;
export const StartEmailSignupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartEmailSignup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartEmailSignupInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startEmailSignup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VerificationRequiredPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StartEmailSignupMutation, StartEmailSignupMutationVariables>;
export const StartEnable2FaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartEnable2FA"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartEnable2FAInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startEnable2FA"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VerificationRequiredPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StartEnable2FaMutation, StartEnable2FaMutationVariables>;
export const StartPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartPasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VerificationRequiredPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StartPasswordResetMutation, StartPasswordResetMutationVariables>;
export const StartStepUpAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartStepUpAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StartStepUpAuthInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startStepUpAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VerificationRequiredPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionID"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StartStepUpAuthMutation, StartStepUpAuthMutationVariables>;
export const VerifyOtpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyOTP"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VerifyOTPInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyOTP"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TwoFactorSuccessPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transactionToken"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MutationErrorPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<VerifyOtpMutation, VerifyOtpMutationVariables>;
export const GetAvatarsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAvatars"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GetAvatarsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAvatars"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"class"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetAvatarsQuery, GetAvatarsQueryVariables>;
export const GetCurrentUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCurrentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCurrentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"is2FAEnabled"}}]}}]}}]} as unknown as DocumentNode<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export const GetEnable2FaVerificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetEnable2FAVerification"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getEnable2FAVerification"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"otpURI"}}]}}]}}]} as unknown as DocumentNode<GetEnable2FaVerificationQuery, GetEnable2FaVerificationQueryVariables>;