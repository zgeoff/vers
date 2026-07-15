import * as E from '@react-email/components';
import { renderEmail } from './render-email';
import { ChangeEmailNotificationEmail } from './templates/change-email-notification';

export function renderChangeEmailNotificationEmail() {
  return renderEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <ChangeEmailNotificationEmail />
      </E.Html>
    ),
  });
}
