import { isIP } from 'node:net';

/** Removes an IPv4-mapped IPv6 prefix and any port, and rejects values that are not IP addresses. */
export function normalizeIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw.split(',')[0]!.trim();
  if (value.startsWith('[')) value = value.slice(1, value.indexOf(']'));
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(':'));
  return isIP(value) ? value : null;
}

/** True for loopback, private, link-local and unspecified addresses, which have no country. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}
