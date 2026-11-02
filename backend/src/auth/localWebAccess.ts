// Only the loopback web server can supply the private backend credential.
// Reject external connections and cross-origin browser calls before injecting it.
export function localWebAuthorization(token: string | undefined, remoteAddress: string | undefined,
  host: string | undefined, origin: string | undefined) {
  if (!token || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress || '')) return undefined;
  if (!host || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return undefined;
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return undefined;
  return `Bearer ${token}`;
}
