import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { ChangeEmailNotificationEmail } from './templates/change-email-notification';

export function generateChangeEmailNotificationEmail() {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <ChangeEmailNotificationEmail />
      </E.Html>
    ),
  });
}
