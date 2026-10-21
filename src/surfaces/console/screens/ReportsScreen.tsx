'use client';

/**
 * Reports (PRD §8.10, M23): generated on request. Choose the report types,
 * date range, amenities and towers, then Generate — a short build with
 * skeleton cards, then the report. Export to Excel (the sheets this role
 * may see; hidden when none), and save it as a schedule ("every Monday at
 * 08:00 by email" — the email is simulated and shows in Scheduled).
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { Download } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import {
  buildReport,
  reportScope,
  type Report,
  type ReportRequest,
} from '@/store/selectors/report';
import { downloadWorkbook, reportSheets, sheetsForRole } from '@/features/reports/workbook';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import { ReportForm } from './parts/ReportForm';
import { ReportView } from './parts/ReportView';
import { ScheduledReports } from './parts/ScheduledReports';
import { useT } from '@/i18n/hooks';

export function ReportsScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [report, setReport] = useState<Report | undefined>();
  const [generating, setGenerating] = useState(false);

  if (!consoleRole || !actor) return null;
  const scope = reportScope(consoleRole, assignedAmenities);
  const canExport = sheetsForRole(consoleRole).length > 0;

  function generate(request: ReportRequest) {
    setGenerating(true);
    setReport(undefined);
    // PRD: "A short progress animation runs while the report builds (0.8–1.5s, with skeleton cards)".
    setTimeout(() => {
      const s = useStore.getState();
      setReport(buildReport(s, request, consoleRole!, assignedAmenities, s.demo.clock.now));
      setGenerating(false);
    }, rules.reports.generateMs);
  }

  async function exportWorkbook() {
    if (!report || !actor) return;
    const sheets = reportSheets(report, consoleRole!).map((x) => x.name);
    dispatch(
      'report.logExport',
      { from: report.request.from, to: report.request.to, sheets },
      actor,
      { assignedAmenities },
    );
    await downloadWorkbook(report, consoleRole!);
    pushToast(slot, t('console.report.exported', { count: sheets.length }), 'success');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.nav.reports')} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6 [&>*]:shrink-0">
        <ReportForm
          slot={slot}
          amenities={scope.amenities}
          onGenerate={generate}
          busy={generating}
        />
        {generating && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        )}
        {report && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-label-1 text-text-title">
                {report.request.from} – {report.request.to}
              </p>
              {canExport && (
                <Button variant="secondary" onClick={exportWorkbook}>
                  <Download className="me-1.5 inline h-4 w-4" strokeWidth={1.5} />
                  {t('console.report.export')}
                </Button>
              )}
            </div>
            <ReportView report={report} />
          </>
        )}
        <ScheduledReports slot={slot} />
      </div>
    </div>
  );
}
