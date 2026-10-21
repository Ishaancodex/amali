'use client';

/** Profile (PRD §6.1): settings (language, per-channel notifications, WhatsApp opt-in), help. */
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { HelpCircle, Languages } from '@/ui/icons';
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
    <div className="flex items-center justify-between py-2.5">
      <span className="text-body-2 text-text-body">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-border-card'}`}
      >
        <span
          className={`bg-surface shadow-card-hover absolute start-0.5 top-0.5 h-5 w-5 rounded-full transition-transform ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : ''
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
    <div className="flex h-full flex-col">
      <TopBar title={t('resident.nav.profile')} />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center gap-2 px-4 pt-4">
          <span className="bg-brand-tint text-title-l text-brand flex h-16 w-16 items-center justify-center rounded-full">
            {resident.avatar}
          </span>
          <p className="text-label-1 text-text-title">{resident.name}</p>
          <p className="text-body-3 text-text-muted">
            <bdi>{unit?.id}</bdi> · <bdi>{resident.email}</bdi>
          </p>
        </div>

        <div className="px-4 pt-6">
          <h2 className="text-label-1 text-text-title mb-2 flex items-center gap-1.5">
            <Languages className="text-brand h-4 w-4" strokeWidth={1.5} />
            {t('resident.profile.language')}
          </h2>
          <div className="flex gap-2">
            {(['en', 'ar'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={locale === l}
                onClick={() => setLocale(slot, l)}
                className={`rounded-input text-label-3 flex-1 border px-3 py-2 transition-colors ${
                  locale === l
                    ? 'border-brand bg-brand-tint text-brand'
                    : 'border-border-card text-text-body'
                }`}
              >
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-6">
          <h2 className="text-label-1 text-text-title mb-1">{t('resident.home.notifications')}</h2>
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
        </div>

        <div className="px-4 pt-6">
          <button type="button" className="text-label-2 text-brand flex items-center gap-2">
            <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
            {t('resident.profile.help')}
          </button>
        </div>
      </div>
    </div>
  );
}
