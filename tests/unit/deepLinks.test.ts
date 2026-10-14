import { describe, it, expect } from 'vitest';
import { isDeepLink, parseDeepLink, buildDeepLink } from '@/navigation/deepLinks';

describe('navigation/deepLinks', () => {
  it('isDeepLink recognizes the amali:// scheme', () => {
    expect(isDeepLink('amali://resident/home')).toBe(true);
    expect(isDeepLink('https://example.com')).toBe(false);
  });

  it('parses a simple link with no params', () => {
    expect(parseDeepLink('amali://guard/scan')).toEqual({
      surface: 'guard',
      route: 'scan',
      params: {},
    });
  });

  it('parses a nested route with query params', () => {
    expect(parseDeepLink('amali://resident/padel/booking/bk_123?from=notification')).toEqual({
      surface: 'resident',
      route: 'padel/booking/bk_123',
      params: { from: 'notification' },
    });
  });

  it('defaults to "home" when no route segment follows the surface', () => {
    expect(parseDeepLink('amali://resident')).toEqual({
      surface: 'resident',
      route: 'home',
      params: {},
    });
  });

  it('rejects an unknown surface', () => {
    expect(parseDeepLink('amali://not-a-surface/home')).toBeNull();
  });

  it('rejects a non-amali URL', () => {
    expect(parseDeepLink('https://example.com/resident/home')).toBeNull();
  });

  it('buildDeepLink round-trips through parseDeepLink', () => {
    const link = buildDeepLink('guard', 'scan', { qr: 'bk_123' });
    expect(link).toBe('amali://guard/scan?qr=bk_123');
    expect(parseDeepLink(link)).toEqual({
      surface: 'guard',
      route: 'scan',
      params: { qr: 'bk_123' },
    });
  });

  it('buildDeepLink with no params omits the query string', () => {
    expect(buildDeepLink('whatsapp', 'thread')).toBe('amali://whatsapp/thread');
  });
});
