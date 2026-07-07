import { buildHoneypotValidFrom } from './build-honeypot-valid-from';
import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';

/**
 * Renders a form-bearing route's hidden anti-spam fields. Server-rendered, so `valid-from` reads
 * the serving time — a submission arriving before that moment, or with the honeypot field
 * non-empty, is treated as spam by the server-side check these fields feed.
 */
export function HoneypotInputs() {
  return (
    <div aria-hidden="true" style={{ display: 'none' }}>
      <label htmlFor={HONEYPOT_FIELD_NAME}>Please leave this field blank</label>
      <input
        autoComplete="off"
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        type="text"
      />
      <input name={HONEYPOT_VALID_FROM_FIELD_NAME} type="hidden" value={buildHoneypotValidFrom()} />
    </div>
  );
}
