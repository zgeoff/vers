import type {
  ActivityStatus,
  AdvanceCheckpointInvalidReason,
  CheckpointInvalidReason,
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

export interface StaleHeadPayload {
  readonly data: { readonly appendedHead: number };
}

export interface CheckpointInvalidPayload {
  readonly data: { readonly reason: CheckpointInvalidReason };
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
