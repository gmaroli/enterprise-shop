import { describe, expect, it } from 'vitest';
import { isPrivateIp, normalizeIp } from './ip';

describe('normalizeIp', () => {
  it('takes the first address of a forwarded list', () => {
    expect(normalizeIp('203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
  });

  it('strips IPv4-mapped prefixes and ports', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp('1.2.3.4:5678')).toBe('1.2.3.4');
    expect(normalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  it('rejects things that are not addresses', () => {
    expect(normalizeIp('not-an-ip')).toBeNull();
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe('isPrivateIp', () => {
  it('flags private, loopback and link-local ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.1.1',
      '::1',
      'fd00::1',
      'fe80::1',
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('does not flag public addresses', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2001:4860:4860::8888']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});
