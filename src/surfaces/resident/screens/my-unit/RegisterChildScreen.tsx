'use client';

/**
 * Register a child (PRD §8.3): name, date of birth (sets the band),
 * allergies, diet, photo consent, emergency contact. Registered against
 * this unit; the household's residents become the default guardians.
 */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { bandForChild } from '@/domain/creche/bands';
import { useErrorText, useT } from '@/i18n/hooks';
import { dubaiDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';

export function RegisterChildScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const errorText = useErrorText();
  const { pop, replace } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [allergy, setAllergy] = useState('');
  const [severe, setSevere] = useState(false);
  const [dietary, setDietary] = useState('');
  const [photoConsent, setPhotoConsent] = useState(true);
  const [error, setError] = useState<string | undefined>();

  if (!resident) return null;
  const band = dob
    ? bandForChild(dob, dubaiDateKey(now), rules.creche.bands, rules.creche.minAcceptedAge)
    : undefined;

  function submit() {
    const result = dispatch(
      'creche.registerChild',
      {
        name,
        dob,
        allergies: allergy.trim() ? { text: allergy.trim(), severe } : undefined,
        dietary,
        photoConsent,
        emergencyContact: { name: resident!.name, phone: resident!.phone },
      },
      { kind: 'resident', id: actorId },
    );
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    pushToast(slot, t('myUnit.registered', { name: result.value.name }), 'success');
    replace('child-detail', { id: result.value.id });
  }

  return (
    <ScreenShell
      eyebrow={t('myUnit.children')}
      title={t('myUnit.registerTitle')}
      onBack={pop}
      image="/amenities/creche.jpg"
      bodyClassName="gap-4"
    >
      <Input label={t('myUnit.fullName')} value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label={t('myUnit.dob')}
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />
      {band && (
        <p className={band.ok ? 'text-body-3 text-text-muted' : 'text-body-3 text-danger'}>
          {band.ok
            ? t('myUnit.bandAge', { band: t(`kids.band.${band.band}`), age: band.age })
            : t(`kids.bandReason.${band.reason}`, { age: rules.creche.minAcceptedAge })}
        </p>
      )}
      <Input
        label={t('myUnit.allergies')}
        value={allergy}
        onChange={(e) => setAllergy(e.target.value)}
        placeholder={t('myUnit.blankIfNone')}
      />
      {allergy.trim() && (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="accent-brand h-5 w-5"
            checked={severe}
            onChange={(e) => setSevere(e.target.checked)}
          />
          <span className="text-label-2 text-text-body">{t('myUnit.severe')}</span>
        </label>
      )}
      <Input
        label={t('myUnit.dietary')}
        value={dietary}
        onChange={(e) => setDietary(e.target.value)}
      />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="accent-brand h-5 w-5"
          checked={photoConsent}
          onChange={(e) => setPhotoConsent(e.target.checked)}
        />
        <span className="text-label-2 text-text-body">{t('myUnit.photoConsent')}</span>
      </label>
      <p className="text-body-3 text-text-muted">
        {t('myUnit.registerNote', { unit: resident.unitId })}
      </p>
      {error && <Banner style="urgent">{error}</Banner>}
      <Button fullWidth disabled={!name.trim() || !band?.ok} onClick={submit}>
        {t('myUnit.register')}
      </Button>
    </ScreenShell>
  );
}
