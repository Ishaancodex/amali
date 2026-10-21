'use client';

/** Add a guardian (PRD §8.3): name, relation, mobile, photo, Emirates ID last 4. A non-resident needs lead approval. */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Camera } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import type { DeviceSlotId } from '@/types/demo';
import { useErrorText, useT } from '@/i18n/hooks';

export function AddGuardianSheet({
  slot,
  childId,
  open,
  onClose,
}: {
  slot: DeviceSlotId;
  childId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const errorText = useErrorText();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Nanny');
  const [phone, setPhone] = useState('');
  const [idLast4, setIdLast4] = useState('');
  const [photoTaken, setPhotoTaken] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function submit() {
    const result = dispatch(
      'creche.addGuardian',
      { childId, name, relation, phone, idLast4, photo: photoTaken ? initials : '' },
      { kind: 'resident', id: actorId },
    );
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    pushToast(
      slot,
      result.value.approval === 'pending'
        ? t('myUnit.guardianPending', { name: result.value.name })
        : t('myUnit.guardianAdded', { name: result.value.name }),
      'success',
    );
    setName('');
    setPhone('');
    setIdLast4('');
    setPhotoTaken(false);
    setError(undefined);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('myUnit.addGuardian')}>
      <div className="flex flex-col gap-3 pb-2">
        <Input
          label={t('myUnit.fullName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('myUnit.relation')}
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        />
        <Input
          label={t('myUnit.mobile')}
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label={t('myUnit.idLast4')}
          inputMode="numeric"
          maxLength={4}
          value={idLast4}
          onChange={(e) => setIdLast4(e.target.value.replace(/\D/g, ''))}
        />
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setPhotoTaken(true)}
          disabled={!name.trim()}
        >
          <Camera className="me-2 inline h-4 w-4" strokeWidth={1.5} />
          {photoTaken ? t('myUnit.photoAdded', { initials }) : t('myUnit.takePhoto')}
        </Button>
        <p className="text-body-3 text-text-muted">{t('myUnit.guardianNote')}</p>
        {error && <Banner style="urgent">{error}</Banner>}
        <Button fullWidth disabled={!name.trim() || idLast4.length !== 4} onClick={submit}>
          {t('myUnit.addGuardianButton')}
        </Button>
      </div>
    </Sheet>
  );
}
