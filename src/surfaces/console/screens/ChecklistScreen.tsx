'use client';

/**
 * Daily operations checklist (PRD §8.5): pick a template, tick each item
 * pass/fail with an optional note, submit — late-ness is computed server
 * side from the template's due time.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';

export function ChecklistScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop, replace } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const templates = useStore((s) => s.checklistTemplates);
  const { actor } = useConsoleActor(slot);

  const templateList = Object.values(templates).sort((a, b) =>
    `${a.amenity}${a.kind}`.localeCompare(`${b.amenity}${b.kind}`),
  );
  const [templateId, setTemplateId] = useState(templateList[0]?.id);
  const [results, setResults] = useState<Record<string, 'pass' | 'fail'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ late: boolean } | undefined>();

  const template = templateId ? templates[templateId] : undefined;

  function setResult(itemId: string, result: 'pass' | 'fail') {
    setResults((prev) => ({ ...prev, [itemId]: result }));
  }

  function submit() {
    if (!template || !actor) return;
    const items = template.items.map((i) => ({
      itemId: i.id,
      result: results[i.id] ?? 'pass',
      note: notes[i.id],
    }));
    const result = dispatch('checklist.submit', { templateId: template.id, items }, actor);
    if (result.ok) {
      setSubmitted({ late: result.value.late });
    } else {
      pushToast(slot, result.error.message, 'error');
    }
  }

  if (submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-title-l text-text-title">Checklist submitted</p>
        {submitted.late && <Banner style="warning">Submitted late.</Banner>}
        <Button onClick={() => replace('ops')}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Checklists" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {templateList.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplateId(t.id);
                  setResults({});
                  setNotes({});
                }}
                className={`rounded-tag text-label-3 px-3 py-1.5 capitalize ${templateId === t.id ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
              >
                {t.amenity} · {t.kind}
              </button>
            ))}
          </div>

          {template && (
            <>
              <p className="text-body-3 text-text-muted">Due {template.dueTime}</p>
              <div className="flex flex-col gap-3">
                {template.items.map((item) => {
                  const result = results[item.id] ?? 'pass';
                  return (
                    <div
                      key={item.id}
                      className="rounded-card border-border-card border-[0.5px] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-label-2 text-text-title">{item.label}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setResult(item.id, 'pass')}
                            className={`rounded-tag text-label-3 px-3 py-1 ${result === 'pass' ? 'bg-success/15 text-success' : 'bg-brand-tint text-brand'}`}
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => setResult(item.id, 'fail')}
                            className={`rounded-tag text-label-3 px-3 py-1 ${result === 'fail' ? 'bg-danger/15 text-danger' : 'bg-brand-tint text-brand'}`}
                          >
                            Fail
                          </button>
                        </div>
                      </div>
                      {result === 'fail' && (
                        <input
                          value={notes[item.id] ?? ''}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="Note (optional)"
                          className="rounded-input border-border-card bg-surface text-body-3 mt-2 h-9 w-full border px-2.5"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <Button fullWidth onClick={submit}>
                Submit
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
