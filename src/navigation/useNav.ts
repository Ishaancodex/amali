'use client';

/**
 * Per-device stack navigation (TRD §6). Each `DeviceSession` has its own
 * nav stack in the store, since two devices can show different screens at
 * once — a plain Next.js route can't represent that.
 */
import { useStore } from '@/store';
import type { DeviceSlotId } from '@/types/demo';
import type { NavStackEntry } from '@/types/demo';
import { parseDeepLink } from './deepLinks';

export interface UseNavResult {
  stack: NavStackEntry[];
  current: NavStackEntry | undefined;
  push: (route: string, params?: Record<string, string>) => void;
  pop: () => void;
  replace: (route: string, params?: Record<string, string>) => void;
  resetTo: (route: string, params?: Record<string, string>) => void;
  /** Resolves an `amali://` link and navigates this device to it (ignores links for other surfaces). */
  openDeepLink: (href: string) => void;
}

export function useNav(slot: DeviceSlotId): UseNavResult {
  const stack = useStore((s) => s.demo.devices[slot]?.nav.stack ?? []);
  const role = useStore((s) => s.demo.devices[slot]?.role);
  const push = useStore((s) => s.pushRoute);
  const pop = useStore((s) => s.popRoute);
  const replace = useStore((s) => s.replaceRoute);
  const resetNavTo = useStore((s) => s.resetNavTo);

  return {
    stack,
    current: stack[stack.length - 1],
    push: (route, params) => push(slot, route, params),
    pop: () => pop(slot),
    replace: (route, params) => replace(slot, route, params),
    resetTo: (route, params) => resetNavTo(slot, route, params),
    openDeepLink: (href) => {
      const link = parseDeepLink(href);
      if (!link || link.surface !== role) return;
      resetNavTo(slot, link.route, link.params);
    },
  };
}
