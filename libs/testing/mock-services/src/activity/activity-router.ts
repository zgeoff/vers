import { getActivityRewards } from './get-activity-rewards';
import { getAvatarProgression } from './get-avatar-progression';
import { getCurrentActivity } from './get-current-activity';
import { getLatestActivityProgress } from './get-latest-activity-progress';
import { resumeActivity } from './resume-activity';
import { startActivity } from './start-activity';
import { stopActivity } from './stop-activity';
import { trackActivityProgress } from './track-activity-progress';

export const activityRouter = {
  getActivityRewards,
  getAvatarProgression,
  getCurrentActivity,
  getLatestActivityProgress,
  resumeActivity,
  startActivity,
  stopActivity,
  trackActivityProgress,
};
