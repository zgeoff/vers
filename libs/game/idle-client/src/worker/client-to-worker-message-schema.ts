import { ActivityFailureAction } from '@vers/idle-core';
import * as z from 'zod';
import { ClientMessageType } from '../types';

const disconnectMessageSchema = z
  .object({
    type: z.literal(ClientMessageType.Disconnect),
  })
  .readonly();

const initializeMessageSchema = z
  .object({
    type: z.literal(ClientMessageType.Initialize),
  })
  .readonly();

const reportOnlineMessageSchema = z
  .object({
    avatarID: z.string(),
    claim: z.boolean(),
    type: z.literal(ClientMessageType.ReportOnline),
  })
  .readonly();

const setFailureActionMessageSchema = z
  .object({
    avatarID: z.string(),
    failureAction: z.enum(ActivityFailureAction),
    type: z.literal(ClientMessageType.SetFailureAction),
  })
  .readonly();

const startActivityMessageSchema = z
  .object({
    avatarID: z.string(),
    requestID: z.string(),
    scopeID: z.string(),
    scopeType: z.string(),
    type: z.literal(ClientMessageType.StartActivity),
  })
  .readonly();

const stopActivityMessageSchema = z
  .object({
    activityID: z.string(),
    avatarID: z.string(),
    type: z.literal(ClientMessageType.StopActivity),
  })
  .readonly();

/**
 * Every message a tab may post to the worker across the shared-worker boundary.
 */
export const clientToWorkerMessageSchema = z.discriminatedUnion('type', [
  disconnectMessageSchema,
  initializeMessageSchema,
  reportOnlineMessageSchema,
  setFailureActionMessageSchema,
  startActivityMessageSchema,
  stopActivityMessageSchema,
]);

export type ClientMessage = z.infer<typeof clientToWorkerMessageSchema>;

export type DisconnectMessage = z.infer<typeof disconnectMessageSchema>;

export type InitializeMessage = z.infer<typeof initializeMessageSchema>;

export type ReportOnlineMessage = z.infer<typeof reportOnlineMessageSchema>;

export type SetFailureActionMessage = z.infer<typeof setFailureActionMessageSchema>;

export type StartActivityMessage = z.infer<typeof startActivityMessageSchema>;

export type StopActivityMessage = z.infer<typeof stopActivityMessageSchema>;
