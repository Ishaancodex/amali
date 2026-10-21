'use client';

/**
 * The composer (PRD §8.7): all fields, a live audience-preview count, and
 * a Publish that either sends now or schedules. The audience builder
 * offers the clause kinds S7's targeting proof needs (tower, floor range,
 * cluster, whole community) as toggleable chips, combined by union — the
 * full generic exclude/bookers/parents/optedIn clause set still exists at
 * the domain/command layer (and is tested there) but isn't exposed here.
 */
import { useMemo, useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { resolveAudience, buildAudiencePreview } from '@/domain/comms/audience';
import { buildDailyUpdateText } from '@/domain/comms/dailyTemplate';
import { toDubai, dubaiDateTimeToIso, addDaysIso } from '@/lib/time';
import { useErrorText, useT } from '@/i18n/hooks';
import { format } from 'date-fns';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import {
  ComposerAudience,
  clausesFor,
  toggleChip,
  type AudienceChip,
  type FloorRange,
} from './parts/ComposerAudience';
import { ComposerDelivery, type Delivery } from './parts/ComposerDelivery';
import { ComposerMessage, type Message } from './parts/ComposerMessage';

/** `datetime-local` values are Dubai wall-clock. */
function toLocalValue(iso: string): string {
  return format(toDubai(iso), "yyyy-MM-dd'T'HH:mm");
}
function fromLocalValue(value: string): string {
  const [dateKey, hhmm] = value.split('T');
  return dubaiDateTimeToIso(dateKey ?? '', hhmm ?? '00:00');
}

export function ComposerScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const errorText = useErrorText();
  const { pop, replace } = useNav(slot);
  const dispatch = useStore((s) => s.dispatch);
  const now = useStore((s) => s.demo.clock.now);
  const residents = useStore((s) => s.residents);
  const units = useStore((s) => s.units);
  const bookings = useStore((s) => s.bookings);
  const rsvps = useStore((s) => s.rsvps);
  const showtimes = useStore((s) => s.showtimes);
  const events = useStore((s) => s.events);
  const guardians = useStore((s) => s.guardians);
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const hours = useStore((s) => s.hours);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const [message, setMessage] = useState<Message>({
    type: 'general',
    title: '',
    body: '',
    amenityTags: [],
  });
  const { type, title, body, amenityTags } = message;
  const [chips, setChips] = useState<Set<AudienceChip>>(new Set(['all']));
  const [floors, setFloors] = useState<FloorRange>({ tower: 'east', from: 10, to: 20 });
  const [delivery, setDelivery] = useState<Delivery>(() => ({
    channels: new Set(['app_push', 'app_banner', 'app_inbox']),
    scheduleMode: 'now',
    scheduleAt: toLocalValue(addDaysIso(now, 1)),
    addBanner: false,
    bannerStyle: 'info',
    bannerExpiry: toLocalValue(addDaysIso(now, 1)),
  }));
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  const clauses = useMemo(() => clausesFor(chips, floors), [chips, floors]);
  const matched = useMemo(
    () =>
      resolveAudience(
        { include: clauses, exclude: [] },
        { residents, units, bookings, rsvps, showtimes, events, guardians },
      ),
    [clauses, residents, units, bookings, rsvps, showtimes, events, guardians],
  );
  const preview = buildAudiencePreview(matched);

  function fillDailyTemplate() {
    setMessage({
      ...message,
      type: 'daily',
      title: t('console.composer.dailyTitle'),
      body: buildDailyUpdateText({ amenities, amenityStatus, hours, now }),
    });
  }

  function handlePublish() {
    if (!actor) return;
    setError(undefined);
    const result = dispatch(
      'announcement.create',
      {
        type,
        title,
        body,
        amenityTags,
        audience: { include: clauses, exclude: [] },
        channels: [...delivery.channels],
        banner: delivery.addBanner
          ? {
              style: delivery.bannerStyle,
              cta: amenityTags[0]
                ? `amali://resident/amenity-detail?key=${amenityTags[0]}`
                : undefined,
              expiresAt: fromLocalValue(delivery.bannerExpiry),
            }
          : undefined,
        schedule:
          delivery.scheduleMode === 'now'
            ? { mode: 'now' }
            : { mode: 'at', at: fromLocalValue(delivery.scheduleAt) },
      },
      actor,
      { assignedAmenities },
    );
    if (result.ok) setSuccess(true);
    else setError(errorText(result.error));
  }

  const waSelected = delivery.channels.has('wa_direct') || delivery.channels.has('wa_channel');
  const sendNow = delivery.scheduleMode === 'now';

  if (success) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-title-l text-text-title">
          {sendNow ? t('console.comms.state.sent') : t('console.comms.state.scheduled')}
        </p>
        <p className="text-body-2 text-text-muted">
          {t('console.composer.reached', {
            residents: preview.residentCount,
            units: preview.unitCount,
          })}
        </p>
        <Button onClick={() => replace('home')}>{t('common.done')}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.composer.title')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <ComposerMessage
            value={message}
            onChange={setMessage}
            waSelected={waSelected}
            onFillDaily={fillDailyTemplate}
          />

          <ComposerAudience
            chips={chips}
            onToggle={(c) => setChips((prev) => toggleChip(prev, c))}
            floors={floors}
            onFloors={setFloors}
            preview={preview}
          />

          <ComposerDelivery value={delivery} onChange={setDelivery} />

          <section>
            <h2 className="text-label-1 text-text-title mb-2">
              {t('console.composer.previewTitle')}
            </h2>
            <div className="rounded-card border-border-card border-[0.5px] p-4">
              <div className="flex items-center gap-2">
                <Tag variant={type === 'urgent' ? 'danger' : 'brand'}>
                  {t(`console.comms.type.${type}`)}
                </Tag>
                <span className="text-label-2 text-text-title">
                  {title || t('console.composer.untitled')}
                </span>
              </div>
              <p className="text-body-2 text-text-body mt-1 whitespace-pre-line">
                {body || t('console.composer.noBody')}
              </p>
            </div>
          </section>

          {error && <Banner style="warning">{error}</Banner>}
          {preview.residentCount === 0 && (
            <Banner style="warning">{t('errors.EMPTY_AUDIENCE')}</Banner>
          )}

          <Button
            fullWidth
            disabled={!title.trim() || !body.trim() || preview.residentCount === 0}
            onClick={handlePublish}
          >
            {sendNow ? t('console.composer.publish') : t('console.composer.scheduleLater')}
          </Button>
        </div>
      </div>
    </div>
  );
}
