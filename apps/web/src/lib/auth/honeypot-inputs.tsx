import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';

interface HoneypotInputsProps {
  /**
   * Epoch-ms timestamp the submission must arrive after. Callers pass a server-issued value from
   * loader data rather than computing one here: a value built while rendering is rebuilt again
   * during hydration, against the browser's clock instead of the server's.
   */
  readonly validFrom: string;
}

/**
 * Renders a form-bearing route's hidden anti-spam fields. A submission arriving before `validFrom`,
 * or carrying a non-empty honeypot field, is treated as spam by the server-side check these fields
 * feed.
 */
export function HoneypotInputs(props: Readonly<HoneypotInputsProps>) {
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
      <input name={HONEYPOT_VALID_FROM_FIELD_NAME} type="hidden" value={props.validFrom} />
    </div>
  );
}
