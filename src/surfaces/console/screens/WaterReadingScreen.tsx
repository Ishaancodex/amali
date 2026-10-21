'use client';

/**
 * Water-quality logging (PRD §8.5): steppers with the acceptable range
 * shown, live out-of-range highlighting, and — the S6 demo moment — an
 * out-of-range reading asks "Set to Limited and raise incident?".
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { outOfRangeParams } from '@/domain/ops/water';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import { WaterTrendChart } from './parts/WaterTrendChart';
import { useErrorText, useT } from '@/i18n/hooks';
import { Shake } from '@/ui/Shake';

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  range,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  range: string;
}) {
  const outOfRange = value < min || value > max;
  const id = `water-${label.replace(/\W+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-3 text-text-muted">
        {label} <span className="text-text-placeholder">({range})</span>
      </label>
      <input
        id={id}
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`rounded-input bg-surface text-body-2 h-11 border px-3 ${outOfRange ? 'border-danger text-danger' : 'border-border-card text-text-body'}`}
      />
    </div>
  );
}

export function WaterReadingScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const errorText = useErrorText();
  const { pop, replace } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const wq = rules.pool.waterQuality;
  const [ph, setPh] = useState(7.4);
  const [freeChlorine, setFreeChlorine] = useState(2.0);
  const [tempC, setTempC] = useState(27);
  const [clarity, setClarity] = useState<'pass' | 'fail'>('pass');
  const [prompting, setPrompting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const outOfRange = outOfRangeParams({ ph, freeChlorine, tempC, clarity }, wq);

  function logReading(withAction: boolean) {
    if (!actor) return;
    const result = dispatch(
      'water.log',
      {
        ph,
        freeChlorine,
        tempC,
        clarity,
        setStatusIfOutOfRange: withAction ? 'limited' : undefined,
        raiseIncidentIfOutOfRange: withAction,
      },
      actor,
      { assignedAmenities },
    );
    if (result.ok) {
      setSubmitted(true);
    } else {
      pushToast(slot, errorText(result.error), 'error');
    }
  }

  function handleSubmit() {
    if (outOfRange.length > 0) {
      setPrompting(true);
      return;
    }
    logReading(false);
  }

  if (submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-title-l text-text-title">{t('console.water.logged')}</p>
        <Button onClick={() => replace('ops')}>{t('common.done')}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.water.title')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <RangeField
            label={t('console.water.param.ph')}
            value={ph}
            onChange={setPh}
            min={wq.ph.min}
            max={wq.ph.max}
            step={0.1}
            range={`${wq.ph.min}–${wq.ph.max}`}
          />
          <RangeField
            label={t('console.water.freeChlorine')}
            value={freeChlorine}
            onChange={setFreeChlorine}
            min={wq.freeChlorinePpm.min}
            max={wq.freeChlorinePpm.max}
            step={0.1}
            range={`${wq.freeChlorinePpm.min}–${wq.freeChlorinePpm.max}`}
          />
          <RangeField
            label={t('console.water.temperature')}
            value={tempC}
            onChange={setTempC}
            min={wq.tempC.min}
            max={wq.tempC.max}
            step={0.5}
            range={`${wq.tempC.min}–${wq.tempC.max}`}
          />

          <div className="flex flex-col gap-1">
            <span className="text-label-3 text-text-muted">{t('console.water.param.clarity')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClarity('pass')}
                className={`rounded-tag text-label-3 flex-1 py-2 text-center ${clarity === 'pass' ? 'bg-success/15 text-success' : 'bg-brand-tint text-brand'}`}
              >
                {t('console.checklist.pass')}
              </button>
              <button
                type="button"
                onClick={() => setClarity('fail')}
                className={`rounded-tag text-label-3 flex-1 py-2 text-center ${clarity === 'fail' ? 'bg-danger/15 text-danger' : 'bg-brand-tint text-brand'}`}
              >
                {t('console.checklist.fail')}
              </button>
            </div>
          </div>

          {prompting && (
            <Shake trigger="out-of-range">
              <Banner
                style="warning"
                cta={{ label: t('common.cancel'), onClick: () => setPrompting(false) }}
              >
                {t('console.water.outOfRange', {
                  params: outOfRange
                    .map((p) =>
                      t(`console.water.param.${p as 'ph' | 'freeChlorine' | 'tempC' | 'clarity'}`),
                    )
                    .join(', '),
                })}
              </Banner>
            </Shake>
          )}

          {prompting ? (
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => logReading(false)}>
                {t('console.water.justLog')}
              </Button>
              <Button fullWidth onClick={() => logReading(true)}>
                {t('common.yes')}
              </Button>
            </div>
          ) : (
            <Button fullWidth onClick={handleSubmit}>
              {t('console.ops.logReading')}
            </Button>
          )}

          <WaterTrendChart />
        </div>
      </div>
    </div>
  );
}
