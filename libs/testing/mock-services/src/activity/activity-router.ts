import { advanceActivity } from './advance-activity';
import { getActivityRewards } from './get-activity-rewards';
import { getAvatarProgression } from './get-avatar-progression';
import { getContentDocument } from './get-content-document';
import { getCurrentActivity } from './get-current-activity';
import { getLatestActivityProgress } from './get-latest-activity-progress';
import { getRevealedNodes } from './get-revealed-nodes';
import { resumeActivity } from './resume-activity';
import { startActivity } from './start-activity';
import { stopActivity } from './stop-activity';
import { trackActivityProgress } from './track-activity-progress';
import { updateFailureAction } from './update-failure-action';

export const activityRouter = {
  advanceActivity,
  getActivityRewards,
  getAvatarProgression,
  getContentDocument,
  getCurrentActivity,
  getLatestActivityProgress,
  getRevealedNodes,
  resumeActivity,
  startActivity,
  stopActivity,
  trackActivityProgress,
  updateFailureAction,
};
