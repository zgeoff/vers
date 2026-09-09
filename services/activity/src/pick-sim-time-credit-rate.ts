import { QA_SIM_SPEED_MAX } from '@vers/contract-activity';

interface MeteredAvatar {
  readonly isQa: boolean;
}

export function pickSimTimeCreditRate(avatar: Readonly<MeteredAvatar>): number {
  return avatar.isQa ? QA_SIM_SPEED_MAX : 1;
}
