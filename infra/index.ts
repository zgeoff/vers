import * as cloudflare from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';

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

export const apexRecord = apex.name;
export const wwwRecord = www.name;
