import type { ClientMessage, ReportOnlineMessage } from '../types';
import { ClientMessageType } from '../types';

export function isReportOnlineMessage(message: ClientMessage): message is ReportOnlineMessage {
  return message.type === ClientMessageType.ReportOnline;
}
