'use client';

/**
 * SOS (Home hero). Pick Security / Medical / Fire, then hold the ring for two seconds: the
 * `sos.raise` command alerts the guards and community manager, so the Guard device reacts live.
 */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { HoldButton } from '@/ui/HoldButton';
import { Button } from '@/ui/Button';
import { Eyebrow } from '@/ui/Eyebrow';
import { Check, Flame, HeartPulse, Shield } from '@/ui/icons';
import type { LucideIcon } from '@/ui/icons';
import { useStore } from '@/store';
import { useErrorText, useT } from '@/i18n/hooks';
import { useUiStore } from '@/store/uiStore';
import type { SosKind } from '@/store/commands/sos';
import type { DeviceSlotId } from '@/types/demo';

const KINDS: { kind: SosKind; icon: LucideIcon }[] = [
  { kind: 'security', icon: Shield },
  { kind: 'medical', icon: HeartPulse },
  { kind: 'fire', icon: Flame },
];

export function SosSheet({
  slot,
  open,
  onClose,
}: {
  slot: DeviceSlotId;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const errorText = useErrorText();
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const unitId = useStore((s) => s.residents[actorId]?.unitId ?? '');
  const pushToast = useUiStore((s) => s.pushToast);
  const [kind, setKind] = useState<SosKind>('security');
  const [sent, setSent] = useState(false);

  function raise() {
    const result = dispatch('sos.raise', { kind }, { kind: 'resident', id: actorId });
    if (!result.ok) {
      pushToast(slot, errorText(result.error), 'error');
      return;
    }
    setSent(true);
  }

  function close() {
    onClose();
    setSent(false);
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      tone="ember"
      title={t(sent ? 'resident.sos.sentTitle' : 'resident.sos.title')}
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <span className="bg-success/25 text-on-ember grid h-20 w-20 place-items-center rounded-full">
            <Check className="h-8 w-8" strokeWidth={1.5} />
          </span>
          <p className="text-body-2 text-on-ember-muted">{t('resident.sos.sentBody')}</p>
          <p className="text-body-3 text-on-ember-muted">{t('resident.sos.demoNote')}</p>
          <Button variant="primary" fullWidth onClick={close}>
            {t('resident.sos.close')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <p className="text-body-2 text-on-ember-muted">{t('resident.sos.body')}</p>
          <div className="flex w-full gap-2" role="group" aria-label={t('resident.sos.title')}>
            {KINDS.map(({ kind: k, icon: KindIcon }) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`border-ember-hairline text-label-3 rounded-tile flex h-11 flex-1 items-center justify-center gap-2 border ${kind === k ? 'bg-ember-hairline text-on-ember' : 'text-on-ember-muted'}`}
              >
                <KindIcon className="h-4 w-4" strokeWidth={1.5} />
                {t(`resident.sos.kind.${k}`)}
              </button>
            ))}
          </div>
          <HoldButton
            label={t('resident.sos.hold')}
            ariaLabel={t('resident.sos.holdAria', { kind: t(`resident.sos.kind.${kind}`) })}
            onComplete={raise}
          />
          <Eyebrow className="text-on-ember-muted">
            {t('resident.sos.where', { kind: t(`resident.sos.kind.${kind}`), unit: unitId })}
          </Eyebrow>
          <Button variant="secondary" fullWidth onClick={close}>
            {t('resident.sos.cancel')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
