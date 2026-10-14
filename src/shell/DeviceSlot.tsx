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
import { ResidentApp } from '@/surfaces/resident/ResidentApp';
import { WhatsAppApp } from '@/surfaces/whatsapp/WhatsAppApp';
import { GuardApp } from '@/surfaces/guard/GuardApp';
import { CrecheApp } from '@/surfaces/creche/CrecheApp';
import { FnbApp } from '@/surfaces/fnb/FnbApp';
import { ConsoleApp } from '@/surfaces/console/ConsoleApp';

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

  if (!device) return null;

  const kind = frameKindFor(device.role, forcePhoneFrame);
  const themeClass = STAFF_DARK_ROLES.includes(device.role) ? 'staff' : '';
  const dir = device.locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="relative h-full w-full">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${device.role}:${kind}`}
          variants={roleDeviceEnter}
          initial="initial"
          animate="animate"
          exit="exit"
          className="h-full w-full"
        >
          <DeviceFrame kind={kind} now={now} dir={dir} lang={device.locale} themeClass={themeClass}>
            <SurfaceFor role={device.role} slot={slot} />
          </DeviceFrame>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
