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
import { Input } from '@/ui/Input';
import { Banner } from '@/ui/Banner';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { resolveAudience, buildAudiencePreview } from '@/domain/comms/audience';
import { buildDailyUpdateText } from '@/domain/comms/dailyTemplate';
import { toDubai, dubaiDateTimeToIso, addDaysIso } from '@/lib/time';
import { format } from 'date-fns';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import type { AnnouncementType, AudienceClause, BannerStyle, Channel } from '@/types/comms';
import { useConsoleActor } from '../useConsoleActor';

const TYPES: AnnouncementType[] = ['daily', 'event', 'closure', 'urgent', 'general'];
const CHANNEL_LABEL: Record<Channel, string> = {
  app_push: 'App push',
  app_banner: 'App home banner',
  app_inbox: 'App inbox',
  wa_direct: 'WhatsApp 1:1',
  wa_channel: 'WhatsApp Channel',
  sms_fallback: 'SMS (fallback only)',
};
const BANNER_STYLES: BannerStyle[] = ['info', 'warning', 'urgent', 'success'];

function toDatetimeLocalValue(iso: string): string {
  return format(toDubai(iso), "yyyy-MM-dd'T'HH:mm");
}

type AudienceChip = 'all' | 'east' | 'west' | 'north' | 'south' | 'floors';

export function ComposerScreen({ slot }: { slot: DeviceSlotId }) {
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

  const [type, setType] = useState<AnnouncementType>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [amenityTags, setAmenityTags] = useState<AmenityKey[]>([]);
  const [chips, setChips] = useState<Set<AudienceChip>>(new Set(['all']));
  const [floorTower, setFloorTower] = useState<'east' | 'west'>('east');
  const [floorFrom, setFloorFrom] = useState(10);
  const [floorTo, setFloorTo] = useState(20);
  const [channels, setChannels] = useState<Set<Channel>>(
    new Set(['app_push', 'app_banner', 'app_inbox']),
  );
  const [scheduleMode, setScheduleMode] = useState<'now' | 'at'>('now');
  const [scheduleAt, setScheduleAt] = useState(toDatetimeLocalValue(addDaysIso(now, 1)));
  const [addBanner, setAddBanner] = useState(false);
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>('info');
  const [bannerExpiry, setBannerExpiry] = useState(toDatetimeLocalValue(addDaysIso(now, 1)));
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  function toggleChip(chip: AudienceChip) {
    setChips((prev) => {
      const next = new Set(chip === 'all' ? [] : prev);
      if (chip === 'all') {
        next.add('all');
      } else {
        next.delete('all');
        if (next.has(chip)) next.delete(chip);
        else next.add(chip);
        if (next.size === 0) next.add('all');
      }
      return next;
    });
  }

  function toggleChannel(channel: Channel) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  function toggleAmenityTag(key: AmenityKey) {
    setAmenityTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const audienceClauses: AudienceClause[] = useMemo(() => {
    const out: AudienceClause[] = [];
    if (chips.has('all')) out.push({ kind: 'all' });
    if (chips.has('east')) out.push({ kind: 'tower', tower: 'east' });
    if (chips.has('west')) out.push({ kind: 'tower', tower: 'west' });
    if (chips.has('north')) out.push({ kind: 'cluster', cluster: 'north' });
    if (chips.has('south')) out.push({ kind: 'cluster', cluster: 'south' });
    if (chips.has('floors'))
      out.push({ kind: 'floors', tower: floorTower, from: floorFrom, to: floorTo });
    return out;
  }, [chips, floorTower, floorFrom, floorTo]);

  const audienceCtx = useMemo(
    () => ({ residents, units, bookings, rsvps, showtimes, events, guardians }),
    [residents, units, bookings, rsvps, showtimes, events, guardians],
  );
  const matched = useMemo(
    () => resolveAudience({ include: audienceClauses, exclude: [] }, audienceCtx),
    [audienceClauses, audienceCtx],
  );
  const preview = buildAudiencePreview(matched);

  function fillDailyTemplate() {
    setType('daily');
    setTitle('Daily amenity update');
    setBody(buildDailyUpdateText({ amenities, amenityStatus, hours, now }));
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
        audience: { include: audienceClauses, exclude: [] },
        channels: [...channels],
        banner: addBanner
          ? {
              style: bannerStyle,
              cta: amenityTags[0]
                ? `amali://resident/amenity-detail?key=${amenityTags[0]}`
                : undefined,
              expiresAt: dubaiDateTimeToIsoFromLocal(bannerExpiry),
            }
          : undefined,
        schedule:
          scheduleMode === 'now'
            ? { mode: 'now' }
            : { mode: 'at', at: dubaiDateTimeToIsoFromLocal(scheduleAt) },
      },
      actor,
      { assignedAmenities },
    );
    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error.message);
    }
  }

  function dubaiDateTimeToIsoFromLocal(value: string): string {
    const [dateKey, hhmm] = value.split('T');
    return dubaiDateTimeToIso(dateKey ?? '', hhmm ?? '00:00');
  }

  const waSelected = channels.has('wa_direct') || channels.has('wa_channel');
  const overLimit = waSelected && body.length > rules.comms.waCharacterLimit;

  if (success) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-title-l text-text-title">
          {scheduleMode === 'now' ? 'Sent' : 'Scheduled'}
        </p>
        <p className="text-body-2 text-text-muted">
          Reached {preview.residentCount} residents · {preview.unitCount} units.
        </p>
        <Button onClick={() => replace('home')}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="New announcement" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section>
            <h2 className="text-label-1 text-text-title mb-2">Type</h2>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-tag text-label-3 px-3 py-1.5 capitalize ${type === t ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                >
                  {t}
                </button>
              ))}
              {type === 'daily' && (
                <Button variant="tertiary" onClick={fillDailyTemplate}>
                  Fill from live status
                </Button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pool maintenance tonight"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-label-3 text-text-muted">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="rounded-input border-border-card bg-surface text-body-2 text-text-body placeholder:text-text-placeholder border px-3 py-2.5"
                placeholder="What residents need to know"
              />
              <span
                className={`text-body-3 self-end ${overLimit ? 'text-danger' : 'text-text-muted'}`}
              >
                {body.length} characters
                {waSelected ? ` (WhatsApp limit ${rules.comms.waCharacterLimit})` : ''}
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Amenity tags</h2>
            <div className="flex flex-wrap gap-2">
              {Object.values(amenities).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleAmenityTag(a.key)}
                  className={`rounded-tag text-label-3 px-3 py-1.5 ${amenityTags.includes(a.key) ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Audience</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'Whole community'],
                  ['east', 'East Tower'],
                  ['west', 'West Tower'],
                  ['north', 'North Villas'],
                  ['south', 'South Villas'],
                  ['floors', 'Floor range'],
                ] as [AudienceChip, string][]
              ).map(([chip, label]) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  className={`rounded-tag text-label-3 px-3 py-1.5 ${chips.has(chip) ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {chips.has('floors') && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={floorTower}
                  onChange={(e) => setFloorTower(e.target.value as 'east' | 'west')}
                  className="rounded-input border-border-card bg-surface text-body-3 h-9 border px-2"
                >
                  <option value="east">East</option>
                  <option value="west">West</option>
                </select>
                <input
                  type="number"
                  value={floorFrom}
                  onChange={(e) => setFloorFrom(Number(e.target.value))}
                  className="rounded-input border-border-card bg-surface text-body-3 h-9 w-20 border px-2"
                />
                <span className="text-body-3 text-text-muted">to</span>
                <input
                  type="number"
                  value={floorTo}
                  onChange={(e) => setFloorTo(Number(e.target.value))}
                  className="rounded-input border-border-card bg-surface text-body-3 h-9 w-20 border px-2"
                />
              </div>
            )}
            <p className="text-body-3 text-text-muted mt-2">
              {preview.residentCount} residents · {preview.unitCount} units · App{' '}
              {preview.appReachable} · WhatsApp {preview.waReachable} · Unreachable{' '}
              {preview.unreachable}
            </p>
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Channels</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHANNEL_LABEL) as Channel[])
                .filter((c) => c !== 'sms_fallback')
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`rounded-tag text-label-3 px-3 py-1.5 ${channels.has(c) ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                  >
                    {CHANNEL_LABEL[c]}
                  </button>
                ))}
            </div>
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Schedule</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleMode('now')}
                className={`rounded-tag text-label-3 px-3 py-1.5 ${scheduleMode === 'now' ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
              >
                Send now
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('at')}
                className={`rounded-tag text-label-3 px-3 py-1.5 ${scheduleMode === 'at' ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
              >
                Schedule
              </button>
              {scheduleMode === 'at' && (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="rounded-input border-border-card bg-surface text-body-3 h-9 border px-2"
                />
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <input
                id="addBanner"
                type="checkbox"
                checked={addBanner}
                onChange={(e) => setAddBanner(e.target.checked)}
              />
              <label htmlFor="addBanner" className="text-label-2 text-text-title">
                Add a home banner
              </label>
            </div>
            {addBanner && (
              <div className="mt-2 flex items-center gap-2">
                {BANNER_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBannerStyle(s)}
                    className={`rounded-tag text-label-3 px-3 py-1.5 capitalize ${bannerStyle === s ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                  >
                    {s}
                  </button>
                ))}
                <input
                  type="datetime-local"
                  value={bannerExpiry}
                  onChange={(e) => setBannerExpiry(e.target.value)}
                  className="rounded-input border-border-card bg-surface text-body-3 h-9 border px-2"
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Preview</h2>
            <div className="rounded-card border-border-card border-[0.5px] p-4">
              <div className="flex items-center gap-2">
                <Tag variant={type === 'urgent' ? 'danger' : 'brand'}>{type}</Tag>
                <span className="text-label-2 text-text-title">{title || 'Untitled'}</span>
              </div>
              <p className="text-body-2 text-text-body mt-1 whitespace-pre-line">
                {body || 'No body yet.'}
              </p>
            </div>
          </section>

          {error && <Banner style="warning">{error}</Banner>}
          {preview.residentCount === 0 && (
            <Banner style="warning">This audience matches no residents.</Banner>
          )}

          <Button
            fullWidth
            disabled={!title.trim() || !body.trim() || preview.residentCount === 0}
            onClick={handlePublish}
          >
            {scheduleMode === 'now' ? 'Publish' : 'Schedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
