/**
 * Deep link parsing (TRD §6). Notifications, WhatsApp quick-reply buttons
 * and scenario steps all share this format:
 *
 *   amali://<surface>/<route>?<params>
 *   amali://resident/padel/booking/bk_123
 *   amali://guard/scan?qr=bk_123
 */
import type { Role } from '@/types/demo';

export interface DeepLink {
  surface: Role;
  route: string;
  params: Record<string, string>;
}

const SCHEME = 'amali://';
const VALID_SURFACES: readonly Role[] = [
  'resident',
  'whatsapp',
  'guard',
  'creche',
  'fnb',
  'console',
];

export function isDeepLink(href: string): boolean {
  return href.startsWith(SCHEME);
}

/** Returns null if `href` isn't a well-formed `amali://` link. */
export function parseDeepLink(href: string): DeepLink | null {
  if (!isDeepLink(href)) return null;
  const rest = href.slice(SCHEME.length);
  const [pathPart = '', queryPart] = rest.split('?', 2);
  const segments = pathPart.split('/').filter(Boolean);
  const surface = segments[0];
  if (!surface || !VALID_SURFACES.includes(surface as Role)) return null;

  const route = segments.slice(1).join('/') || 'home';
  const params: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [key, value] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
    }
  }

  return { surface: surface as Role, route, params };
}

export function buildDeepLink(
  surface: Role,
  route: string,
  params: Record<string, string> = {},
): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${SCHEME}${surface}/${route}${query ? `?${query}` : ''}`;
}
