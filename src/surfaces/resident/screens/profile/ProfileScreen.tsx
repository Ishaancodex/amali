'use client';

/** Profile (PRD §6.1): settings (language, per-channel notifications, WhatsApp opt-in), help. */
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Card } from '@/ui/Card';
import { HelpCircle } from '@/ui/icons';
import { useStore } from '@/store';
import type { DeviceSlotId } from '@/types/demo';
import { useT } from '@/i18n/hooks';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-body-2 text-text-body">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-ember' : 'bg-border-card'}`}
      >
        <span
          className={`bg-surface shadow-card-hover absolute start-1 top-1 h-5 w-5 rounded-full transition-transform ${
            checked ? 'translate-x-4 rtl:-translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}

export function ProfileScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));
  const locale = useStore((s) => s.demo.devices[slot]?.locale ?? 'en');
  const setLocale = useStore((s) => s.setLocale);
  const updateChannels = useStore((s) => s.updateResidentChannels);

  if (!resident) return null;

  return (
    <ScreenShell
      eyebrow={t('resident.profile.eyebrow')}
      title={t('resident.nav.profile')}
      image="/stock/profile.jpg"
      headerExtra={
        <div className="mt-4 flex items-center gap-3">
          <span className="bg-ember-raised text-sand-soft font-wide text-eyebrow flex h-12 w-12 items-center justify-center rounded-full">
            {resident.avatar}
          </span>
          <div>
            <p className="text-label-1 text-on-ember">{resident.name}</p>
            <p className="text-body-3 text-on-ember-muted">
              <bdi>{unit?.id}</bdi> · <bdi>{resident.email}</bdi>
            </p>
          </div>
        </div>
      }
    >
      <section>
        <SectionHeading title={t('resident.profile.language')} />
        <SegmentedTabs
          label={t('resident.profile.language')}
          items={[
            { id: 'en', label: 'English' },
            { id: 'ar', label: 'العربية' },
          ]}
          value={locale}
          onChange={(l) => setLocale(slot, l)}
        />
      </section>

      <section>
        <SectionHeading title={t('resident.home.notifications')} />
        <Card className="divide-border-card divide-y py-0">
          <Toggle
            label={t('resident.profile.appPush')}
            checked={resident.channels.appPush}
            onChange={(v) => updateChannels(resident.id, { appPush: v })}
          />
          <Toggle
            label={t('resident.profile.whatsapp')}
            checked={resident.channels.whatsapp}
            onChange={(v) => updateChannels(resident.id, { whatsapp: v })}
          />
          <Toggle
            label={t('resident.profile.whatsappOptIn')}
            checked={resident.channels.whatsappOptIn}
            onChange={(v) => updateChannels(resident.id, { whatsappOptIn: v })}
          />
        </Card>
        {!resident.channels.appPush && (
          <p className="text-body-3 text-text-muted mt-2">{t('resident.profile.pushOffNudge')}</p>
        )}
      </section>

      <button
        type="button"
        className="font-wide text-eyebrow text-brand flex items-center gap-2 self-start"
      >
        <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
        {t('resident.profile.help')}
      </button>
    </ScreenShell>
  );
}
