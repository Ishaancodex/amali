'use client';

/** The composer's delivery options (PRD §8.7): channels, send now or schedule, and an optional home banner. */
import { useT } from '@/i18n/hooks';
import type { BannerStyle, Channel } from '@/types/comms';

const CHANNELS: Channel[] = ['app_push', 'app_banner', 'app_inbox', 'wa_direct', 'wa_channel'];
const BANNER_STYLES: BannerStyle[] = ['info', 'warning', 'urgent', 'success'];
const FIELD = 'rounded-input border-border-card bg-surface text-body-3 h-9 border px-2';
const chip = (on: boolean) =>
  `rounded-tag text-label-3 px-3 py-1.5 ${on ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`;

export interface Delivery {
  channels: Set<Channel>;
  scheduleMode: 'now' | 'at';
  scheduleAt: string;
  addBanner: boolean;
  bannerStyle: BannerStyle;
  bannerExpiry: string;
}

export function ComposerDelivery({
  value,
  onChange,
}: {
  value: Delivery;
  onChange: (next: Delivery) => void;
}) {
  const t = useT();
  const set = (patch: Partial<Delivery>) => onChange({ ...value, ...patch });
  function toggleChannel(c: Channel) {
    const channels = new Set(value.channels);
    if (channels.has(c)) channels.delete(c);
    else channels.add(c);
    set({ channels });
  }

  return (
    <>
      <section>
        <h2 className="text-label-1 text-text-title mb-2">{t('console.composer.channels')}</h2>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={value.channels.has(c)}
              onClick={() => toggleChannel(c)}
              className={chip(value.channels.has(c))}
            >
              {t(`console.channel.${c}`)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-label-1 text-text-title mb-2">{t('console.composer.schedule')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={value.scheduleMode === 'now'}
            onClick={() => set({ scheduleMode: 'now' })}
            className={chip(value.scheduleMode === 'now')}
          >
            {t('console.composer.sendNow')}
          </button>
          <button
            type="button"
            aria-pressed={value.scheduleMode === 'at'}
            onClick={() => set({ scheduleMode: 'at' })}
            className={chip(value.scheduleMode === 'at')}
          >
            {t('console.composer.scheduleLater')}
          </button>
          {value.scheduleMode === 'at' && (
            <input
              type="datetime-local"
              aria-label={t('console.composer.sendAt')}
              value={value.scheduleAt}
              onChange={(e) => set({ scheduleAt: e.target.value })}
              className={FIELD}
            />
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <input
            id="addBanner"
            type="checkbox"
            checked={value.addBanner}
            onChange={(e) => set({ addBanner: e.target.checked })}
          />
          <label htmlFor="addBanner" className="text-label-2 text-text-title">
            {t('console.composer.addBanner')}
          </label>
        </div>
        {value.addBanner && (
          <div className="mt-2 flex items-center gap-2">
            {BANNER_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={value.bannerStyle === s}
                onClick={() => set({ bannerStyle: s })}
                className={chip(value.bannerStyle === s)}
              >
                {t(`console.composer.bannerStyle.${s}`)}
              </button>
            ))}
            <input
              type="datetime-local"
              aria-label={t('console.composer.bannerExpiry')}
              value={value.bannerExpiry}
              onChange={(e) => set({ bannerExpiry: e.target.value })}
              className={FIELD}
            />
          </div>
        )}
      </section>
    </>
  );
}
