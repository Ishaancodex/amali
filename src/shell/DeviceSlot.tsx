'use client';

/**
 * Picks the device frame + surface for one `DeviceSession` (PRD §4.2) and
 * animates the switch between them (PRD M1): the outgoing frame scales
 * down and fades, the incoming one scales from 1.04→1 and fades in. A
 * frame-kind change (phone→tablet) is covered by keying on `${role}:${kind}`,
 * which makes AnimatePresence treat it as a full swap rather than a resize.
 */
import { AnimatePresence, motion } from 'motion/react';
import { DeviceFrame } from './DeviceFrame';
import { roleDeviceEnter } from '@/design/motion';
import { useStore } from '@/store';
import { defaultFeatures } from '@/config/features';
import type { DeviceKind } from '@/design/tokens';
import type { DeviceSlotId, Role } from '@/types/demo';
import dynamic from 'next/dynamic';
import { IslandNotification } from '@/features/notifications/IslandNotification';
import { ToastHost } from './ToastHost';
import { ResetSplash } from './ResetSplash';
import { DeviceLocale, useShownLocale } from '@/i18n/DeviceLocale';

// Each role's surface is its own chunk (TRD §14: first load ≤ 350 KB) — the console, F&B and the
// report charts only load when a device switches to them.
const blank = () => <div className="bg-bg-page h-full w-full" />;
const loadResident = () => import('@/surfaces/resident/ResidentApp');
// The resident app is what the demo opens on: start its download with the shell, not after it.
if (typeof window !== 'undefined') void loadResident();
const ResidentApp = dynamic(() => loadResident().then((m) => m.ResidentApp), {
  loading: blank,
});
const WhatsAppApp = dynamic(
  () => import('@/surfaces/whatsapp/WhatsAppApp').then((m) => m.WhatsAppApp),
  { loading: blank },
);
const GuardApp = dynamic(() => import('@/surfaces/guard/GuardApp').then((m) => m.GuardApp), {
  loading: blank,
});
const CrecheApp = dynamic(() => import('@/surfaces/creche/CrecheApp').then((m) => m.CrecheApp), {
  loading: blank,
});
const FnbApp = dynamic(() => import('@/surfaces/fnb/FnbApp').then((m) => m.FnbApp), {
  loading: blank,
});
const ConsoleApp = dynamic(
  () => import('@/surfaces/console/ConsoleApp').then((m) => m.ConsoleApp),
  { loading: blank },
);

const STAFF_DARK_ROLES: readonly Role[] = ['guard', 'creche'];

function frameKindFor(role: Role, forcePhoneFrame: boolean): DeviceKind {
  if (forcePhoneFrame) return 'phone';
  if (role === 'fnb') return 'tablet';
  if (role === 'console') return 'browser';
  return 'phone';
}

function SurfaceFor({ role, slot }: { role: Role; slot: DeviceSlotId }) {
  switch (role) {
    case 'resident':
      return <ResidentApp slot={slot} />;
    case 'whatsapp':
      return <WhatsAppApp slot={slot} />;
    case 'guard':
      return <GuardApp slot={slot} />;
    case 'creche':
      return <CrecheApp slot={slot} />;
    case 'fnb':
      return <FnbApp slot={slot} />;
    case 'console':
      return <ConsoleApp slot={slot} />;
  }
}

export function DeviceSlot({ slot }: { slot: DeviceSlotId }) {
  const device = useStore((s) => s.demo.devices[slot]);
  const now = useStore((s) => s.demo.clock.now);
  // forcePhoneFrame isn't in the store yet (it's a build-time/dev flag, not a presenter toggle) — reserved for a future PresenterMenu item.
  const forcePhoneFrame = defaultFeatures.forcePhoneFrame;
  const { shown: locale, controls } = useShownLocale(device?.locale ?? 'en');

  if (!device) return null;

  const kind = frameKindFor(device.role, forcePhoneFrame);
  const themeClass = STAFF_DARK_ROLES.includes(device.role) ? 'staff' : '';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="relative h-full w-full" data-device={slot}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${device.role}:${kind}`}
          variants={roleDeviceEnter}
          initial="initial"
          animate="animate"
          exit="exit"
          className="h-full w-full"
        >
          <DeviceFrame kind={kind} now={now} dir={dir} lang={locale} themeClass={themeClass}>
            <DeviceLocale locale={locale} controls={controls}>
              <SurfaceFor role={device.role} slot={slot} />
              {kind === 'phone' && <IslandNotification slot={slot} />}
              <ToastHost slot={slot} />
              <ResetSplash />
            </DeviceLocale>
          </DeviceFrame>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
