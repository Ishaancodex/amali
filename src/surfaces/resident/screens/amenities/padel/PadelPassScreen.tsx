'use client';

/**
 * The booking pass: a keepsake ticket on Ember with the booking's QR. The code is the booking id
 * (`amali://booking/<id>`), the same id the Guard's check-in works from.
 */
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft } from '@/ui/icons';
import { Eyebrow } from '@/ui/Eyebrow';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ScreenShell } from '@/ui/ScreenShell';
import { QrCode } from '@/ui/icons';
import { rise } from '@/design/motion';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Eyebrow className="block">{label}</Eyebrow>
      <p className="text-label-2 text-text-title mt-0.5 truncate">{value}</p>
    </div>
  );
}

export function PadelPassScreen({
  slot,
  bookingId,
  fresh,
}: {
  slot: DeviceSlotId;
  bookingId: string;
  /** Just booked: the eyebrow says "Reserved". */
  fresh?: boolean;
}) {
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const { pop } = useNav(slot);
  const booking = useStore((s) => s.bookings[bookingId]);
  const resident = useStore((s) => (booking ? s.residents[booking.bookerId] : undefined));

  if (!booking) {
    return (
      <ScreenShell
        eyebrow={t('resident.pass.eyebrow')}
        title={t('resident.pass.eyebrow')}
        onBack={pop}
        image="/amenities/padel.jpg"
      >
        <EmptyState icon={QrCode} message={t('resident.pass.notFound')} />
      </ScreenShell>
    );
  }

  const checkedIn = booking.state === 'checked_in';

  return (
    <div className="ember-band grain flex min-h-full flex-col items-center px-5 pt-14 pb-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/amenities/padel.jpg"
        alt=""
        className="rounded-b-sheet absolute inset-x-0 top-0 h-72 w-full object-cover"
      />
      <div className="bg-ember-veil rounded-b-sheet absolute inset-x-0 top-0 h-72" />
      <div className="relative z-10 flex w-full items-center justify-between">
        <button
          type="button"
          onClick={pop}
          aria-label={t('common.back')}
          className="border-ember-hairline text-on-ember flex h-10 w-10 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.5} />
        </button>
        <Eyebrow className="text-on-ember-muted">
          {t(fresh ? 'resident.pass.reserved' : 'resident.pass.eyebrow')}
        </Eyebrow>
      </div>

      <motion.h1
        className="font-serif-display text-serif-hero relative z-10 my-6 text-center"
        variants={rise}
        initial="initial"
        animate="animate"
        custom={0}
      >
        {t('resident.pass.title')}
      </motion.h1>

      <motion.div
        className="bg-surface text-text-title rounded-sheet shadow-card-hover relative z-10 w-full"
        variants={rise}
        initial="initial"
        animate="animate"
        custom={1}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/amali-logo-white.svg" alt="" className="h-5 w-auto invert" />
          <Tag variant={checkedIn ? 'info' : 'success'}>
            {t(checkedIn ? 'resident.pass.checkedIn' : 'resident.pass.confirmed')}
          </Tag>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 pb-5">
          <Field label={t('resident.pass.space')} value={amenityLabel('padel')} />
          <Field label={t('resident.pass.date')} value={fmt.date(booking.start)} />
          <Field
            label={t('resident.pass.time')}
            value={`${fmt.time(booking.start)} – ${fmt.time(booking.end)}`}
          />
          <Field label={t('resident.pass.players')} value={fmt.num(booking.players.length)} />
          <Field
            label={t('resident.pass.resident')}
            value={`${resident?.name.split(' ')[0] ?? ''} · ${booking.unitId}`}
          />
          <Field label={t('resident.pass.reference')} value={booking.id.slice(-8).toUpperCase()} />
        </div>
        <div className="border-sand-soft relative mx-5 border-t border-dashed">
          <span className="bg-ember absolute -start-8 -top-3 h-6 w-6 rounded-full" />
          <span className="bg-ember absolute -end-8 -top-3 h-6 w-6 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-3 px-5 py-6">
          <QRCodeSVG
            value={`amali://booking/${booking.id}`}
            size={124}
            fgColor="currentColor"
            bgColor="transparent"
            className="text-text-title"
            aria-label={t('resident.pass.reference')}
          />
          <Eyebrow className="text-center">{t('resident.pass.hint')}</Eyebrow>
        </div>
      </motion.div>

      <motion.div
        className="relative z-10 mt-6 w-full"
        variants={rise}
        initial="initial"
        animate="animate"
        custom={2}
      >
        <Button variant="secondary" fullWidth onClick={pop}>
          {t('resident.pass.done')}
        </Button>
      </motion.div>
    </div>
  );
}
