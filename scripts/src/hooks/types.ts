/**
 * The gate's answer for one edit: `allow` lets the tool call through, `deny` names the skills the
 * session must load first.
 */
export type SkillGateVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly missing: ReadonlyArray<string> };
