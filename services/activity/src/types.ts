import type {
  ActivityStatus,
  AdvanceCheckpointInvalidReason,
  CheckpointInvalidReason,
  ConflictReason,
} from '@vers/contract-activity';

export interface MissingSessionPayload {
  readonly data: { readonly reason: 'missing-session' };
}

export interface EmptyErrorPayload {
  readonly data: Record<never, never>;
}

export interface AvatarNotActivePayload {
  readonly data: { readonly activeAvatarID: string; readonly activeAvatarName: string };
}

export interface SimVersionProblemPayload {
  readonly data: { readonly currentSimVersion: string | null };
}

export interface ConflictPayload {
  readonly data: {
    readonly activityID: string;
    readonly appendedHead: number;
    readonly avatarID: string;
    readonly reason: ConflictReason;
  };
}

export interface CheckpointInvalidPayload {
  readonly data: {
    readonly activityID: string;
    readonly avatarID: string;
    readonly reason: CheckpointInvalidReason;
  };
}

export interface TerminalStatusPayload {
  readonly data: { readonly appendedHead: number; readonly status: ActivityStatus };
}

export interface CappedPayload {
  readonly data: { readonly appendedHead: number };
}

export interface AdvanceBailPayload {
  readonly data: { readonly activityID: string; readonly appendedHead: number };
}

export interface AdvanceCheckpointInvalidPayload {
  readonly data: {
    readonly activityID: string;
    readonly appendedHead: number;
    readonly avatarID: string;
    readonly reason: AdvanceCheckpointInvalidReason;
  };
}

export interface AdvanceTerminalPayload {
  readonly data: {
    readonly activityID: string;
    readonly appendedHead: number;
    readonly status: ActivityStatus;
  };
}
