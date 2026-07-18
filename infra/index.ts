import * as cloudflare from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';

export {
  alarmsNotifierName,
  serverErrorsMonitorName,
  verificationLagMonitorName,
} from './axiom.ts';

const config = new pulumi.Config();

const zoneId = config.require('zoneId');
const zoneName = config.require('zoneName');
const appHostname = config.require('appHostname');

// Apex and www both resolve to the Fly app. Cloudflare flattens the apex CNAME to
// the app's addresses, so no Fly IP is hardcoded here. Records stay DNS-only
// (unproxied) so Fly terminates TLS directly via its own managed certificates.
const apex = new cloudflare.DnsRecord('apex', {
  zoneId,
  name: zoneName,
  type: 'CNAME',
  content: appHostname,
  ttl: 1,
  proxied: false,
});

const www = new cloudflare.DnsRecord('www', {
  zoneId,
  name: `www.${zoneName}`,
  type: 'CNAME',
  content: appHostname,
  ttl: 1,
  proxied: false,
});

// Resend sending domain: transactional.versidle.com (region ap-northeast-1). DKIM signs the
// mail, and the send.* MX + SPF records cover the bounce/return-path host Resend uses. TXT
// content is quote-wrapped — the Cloudflare API stores TXT values quoted, and unquoted input
// re-diffs on every plan.
const resendDKIM = new cloudflare.DnsRecord('resend-dkim', {
  zoneId,
  name: `resend._domainkey.transactional.${zoneName}`,
  type: 'TXT',
  content:
    '"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXpfNhIJ/kY0xppICdEmDeaVBWb1rZUhhlVrW2BvD/F1v3cEHSoZeiDxx+Hl+5x6ewydAxQ3abToYMK+H2mDYoAh19xXCOCyWttCiuhbOzdVHSX1pVUnJqr5nOnWpCOczmRzsjzxbd+2AZGUyQd5voFxU/7/PRafZbZ8zFS1zMlQIDAQAB"',
  ttl: 1,
});

const resendReturnPathMX = new cloudflare.DnsRecord('resend-return-path-mx', {
  zoneId,
  name: `send.transactional.${zoneName}`,
  type: 'MX',
  content: 'feedback-smtp.ap-northeast-1.amazonses.com',
  priority: 10,
  ttl: 1,
});

const resendReturnPathSPF = new cloudflare.DnsRecord('resend-return-path-spf', {
  zoneId,
  name: `send.transactional.${zoneName}`,
  type: 'TXT',
  content: '"v=spf1 include:amazonses.com ~all"',
  ttl: 1,
});

// p=none observes only: DMARC reports flow without asking receivers to reject, which is the
// safe starting policy for a fresh sending domain.
const resendDMARC = new cloudflare.DnsRecord('resend-dmarc', {
  zoneId,
  name: `_dmarc.transactional.${zoneName}`,
  type: 'TXT',
  content: '"v=DMARC1; p=none;"',
  ttl: 1,
});

export const apexRecord = apex.name;
export const wwwRecord = www.name;
export const resendDKIMRecord = resendDKIM.name;
export const resendReturnPathMXRecord = resendReturnPathMX.name;
export const resendReturnPathSPFRecord = resendReturnPathSPF.name;
export const resendDMARCRecord = resendDMARC.name;
