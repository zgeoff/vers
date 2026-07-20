import type { ReportOnlineMessage } from '../types';
import { ClientMessageType } from '../types';

export function createReportOnlineMessage(avatarID: string, claim: boolean): ReportOnlineMessage {
  return { avatarID, claim, type: ClientMessageType.ReportOnline };
}
