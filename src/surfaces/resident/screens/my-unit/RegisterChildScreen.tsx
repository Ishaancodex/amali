'use client';

/**
 * Register a child (PRD §8.3): name, date of birth (sets the band),
 * allergies, diet, photo consent, emergency contact. Registered against
 * this unit; the household's residents become the default guardians.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { BAND_LABEL, bandForChild } from '@/domain/creche/bands';
import { dubaiDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';

export function RegisterChildScreen({ slot }: { slot: DeviceSlotId }) {
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
      setError(result.error.message);
      return;
    }
    pushToast(slot, `${result.value.name} registered.`, 'success');
    replace('child-detail', { id: result.value.id });
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Register a child" onBack={pop} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Date of birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        {band && (
          <p className={band.ok ? 'text-body-3 text-text-muted' : 'text-body-3 text-danger'}>
            {band.ok ? `${BAND_LABEL[band.band]} band (age ${band.age})` : band.message}
          </p>
        )}
        <Input
          label="Allergies / medical notes"
          value={allergy}
          onChange={(e) => setAllergy(e.target.value)}
          placeholder="Leave blank if none"
        />
        {allergy.trim() && (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="accent-brand h-5 w-5"
              checked={severe}
              onChange={(e) => setSevere(e.target.checked)}
            />
            <span className="text-label-2 text-text-body">
              Severe — staff must confirm the allergy plan at check-in
            </span>
          </label>
        )}
        <Input
          label="Dietary restrictions"
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
          <span className="text-label-2 text-text-body">Photo consent</span>
        </label>
        <p className="text-body-3 text-text-muted">
          Registered to {resident.unitId}. Your household are the default guardians; emergency
          contact is you.
        </p>
        {error && <Banner style="urgent">{error}</Banner>}
        <Button fullWidth disabled={!name.trim() || !band?.ok} onClick={submit}>
          Register
        </Button>
      </div>
    </div>
  );
}
