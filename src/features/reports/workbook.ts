/**
 * The Excel export (PRD §8.10 "Export to Excel"). `reportSheets` decides
 * the sheets and their columns from the report and the role — pure, so
 * a test can snapshot names and headers per role; `buildWorkbook` turns
 * that into an ExcelJS workbook (bold header row, frozen panes, AED
 * currency format, dates in Dubai time); `downloadWorkbook` saves it as
 * `amali-amenities-report_<from>_<to>.xlsx`.
 *
 * Sheets: Summary, Utilisation, Peak hours, Bookings, No-shows, Revenue,
 * Communications, Work orders. A Community Manager gets all eight; an
 * Amenity Supervisor gets utilisation, no-show and ops sheets for their
 * assigned amenities (no Revenue — PRD §8.11); a role with no report
 * access gets none (and the button is hidden).
 */
import ExcelJS from 'exceljs';
import { grantFor } from '@/domain/rbac/can';
import { REVENUE_SOURCES } from '@/domain/reports/kpis';
import { dubaiDateTimeToIso, toDubai } from '@/lib/time';
import type { ConsoleRole } from '@/types/demo';
import type { Report } from '@/store/selectors/report';

export type CellKind = 'text' | 'percent' | 'aed' | 'number' | 'datetime';

export interface SheetColumn {
  header: string;
  kind: CellKind;
  width: number;
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  rows: (string | number | null)[][];
}

export const ALL_SHEETS = [
  'Summary',
  'Utilisation',
  'Peak hours',
  'Bookings',
  'No-shows',
  'Revenue',
  'Communications',
  'Work orders',
] as const;
const SUPERVISOR_SHEETS: readonly string[] = [
  'Summary',
  'Utilisation',
  'Peak hours',
  'No-shows',
  'Work orders',
];

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AMENITY: Record<string, string> = {
  padel: 'Padel',
  screening: 'Screening Room',
  music: 'Music Room',
  dining: 'Restaurant',
  pool: 'Adult Pool',
  gym: 'Sky Gym',
  creche: 'Kids’ Club',
};

/** The sheets a role may export (PRD §8.11 "Reports and Excel export"). */
export function sheetsForRole(role: ConsoleRole): readonly string[] {
  const grant = grantFor(role, 'reports.export');
  if (!grant || grant.scope === 'none') return [];
  return grant.scope === 'all' && grantFor(role, 'revenue.view')?.scope === 'all'
    ? ALL_SHEETS
    : SUPERVISOR_SHEETS;
}

const col = (header: string, kind: CellKind, width = 16): SheetColumn => ({ header, kind, width });

export function reportSheets(report: Report, role: ConsoleRole): SheetSpec[] {
  const allowed = sheetsForRole(role);
  const pct = (v: number | undefined) => (v === undefined ? null : v);
  const specs: SheetSpec[] = [
    {
      name: 'Summary',
      columns: [col('Measure', 'text', 34), col('Value', 'text', 22)],
      rows: [
        ['Period', `${report.request.from} to ${report.request.to}`],
        ['Amenities', report.amenities.map((a) => AMENITY[a]).join(', ')],
        ...report.utilisation.map((u) => [
          `${AMENITY[u.amenity]} ${u.kind}`,
          u.value === undefined ? '—' : `${Math.round(u.value * 100)}%`,
        ]),
        ...report.noShows.byAmenity.map((n) => [
          `${AMENITY[n.amenity]} no-show rate`,
          n.noShowRate === undefined ? '—' : `${(n.noShowRate * 100).toFixed(1)}%`,
        ]),
        [
          'SLA compliance',
          report.ops.slaCompliance === undefined
            ? '—'
            : `${Math.round(report.ops.slaCompliance * 100)}%`,
        ],
        ...(report.revenue ? [['Revenue (AED)', (report.revenue.total / 100).toFixed(2)]] : []),
      ],
    },
    {
      name: 'Utilisation',
      columns: [col('Amenity', 'text', 20), col('Measure', 'text'), col('Value', 'percent')],
      rows: report.utilisation.map((u) => [
        AMENITY[u.amenity]!,
        u.kind === 'occupancy' ? 'Occupancy' : 'Utilisation',
        pct(u.value),
      ]),
    },
    {
      name: 'Peak hours',
      columns: [
        col('Amenity', 'text', 20),
        col('Day', 'text', 14),
        col('Hour', 'text', 10),
        col('Value', 'percent'),
      ],
      rows: Object.entries(report.heatmaps).flatMap(([amenity, cells]) =>
        [...(cells ?? [])]
          .sort((a, b) => b.value - a.value)
          .map((c) => [
            AMENITY[amenity]!,
            WEEKDAY[c.weekday]!,
            `${String(c.hour).padStart(2, '0')}:00`,
            c.value,
          ]),
      ),
    },
    {
      name: 'Bookings',
      columns: [col('Date', 'text', 14), col('Weekday', 'text', 14), col('Bookings', 'number')],
      rows: report.trends.daily.map((p) => [
        p.date,
        WEEKDAY[toDubai(dubaiDateTimeToIso(p.date, '12:00')).getDay()]!,
        p.value,
      ]),
    },
    {
      name: 'No-shows',
      columns: [
        col('Amenity', 'text', 20),
        col('Bookings', 'number'),
        col('No-show rate', 'percent'),
        col('Late cancellation rate', 'percent', 22),
      ],
      rows: report.noShows.byAmenity.map((n) => [
        AMENITY[n.amenity]!,
        n.bookings,
        pct(n.noShowRate),
        pct(n.lateCancelRate),
      ]),
    },
    {
      name: 'Revenue',
      columns: [col('Source', 'text', 30), col('Amount', 'aed')],
      rows: report.revenue
        ? [
            ...REVENUE_SOURCES.map((src) => [src, report.revenue!.bySource[src] / 100]),
            ['Refunds', -report.revenue.refunds / 100],
            ['Total', report.revenue.total / 100],
          ]
        : [],
    },
    {
      name: 'Communications',
      columns: [
        col('Messages', 'number'),
        col('Recipients', 'number'),
        col('Delivered', 'percent'),
        col('Median minutes to read', 'number', 24),
      ],
      rows: [
        [
          report.comms.messages,
          report.comms.recipients,
          pct(report.comms.deliveryRate),
          report.comms.medianReadMinutes ?? null,
        ],
      ],
    },
    {
      name: 'Work orders',
      columns: [
        col('Work order', 'text', 18),
        col('Amenity', 'text'),
        col('Title', 'text', 30),
        col('Priority', 'text', 10),
        col('Created', 'datetime', 20),
        col('Resolved', 'datetime', 20),
        col('Within SLA', 'text', 12),
      ],
      rows: report.workOrders.map((w) => [
        w.id,
        AMENITY[w.amenity] ?? w.amenity,
        w.title,
        w.priority,
        w.createdAt,
        w.resolvedAt,
        w.withinSla ? 'Yes' : 'No',
      ]),
    },
  ];
  return specs.filter((s) => allowed.includes(s.name));
}

const NUM_FMT: Partial<Record<CellKind, string>> = {
  percent: '0.0%',
  aed: '"AED" #,##0.00',
  number: '#,##0',
  datetime: 'dd mmm yyyy hh:mm',
};

/** An instant as a timezone-less Excel date showing Dubai wall-clock time. */
function dubaiExcelDate(iso: string): Date {
  const d = toDubai(iso);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()),
  );
}

export function buildWorkbook(sheets: SheetSpec[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amali Residences';
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = spec.columns.map((c, i) => ({
      header: c.header,
      key: `c${i}`,
      width: c.width,
      style: NUM_FMT[c.kind] ? { numFmt: NUM_FMT[c.kind] } : {},
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of spec.rows) {
      ws.addRow(
        row.map((v, i) =>
          spec.columns[i]?.kind === 'datetime' && typeof v === 'string' ? dubaiExcelDate(v) : v,
        ),
      );
    }
  }
  return wb;
}

export function workbookFileName(report: Report): string {
  return `amali-amenities-report_${report.request.from}_${report.request.to}.xlsx`;
}

/** Browser-only: writes the file and hands it to the user. */
export async function downloadWorkbook(report: Report, role: ConsoleRole): Promise<void> {
  const buffer = await buildWorkbook(reportSheets(report, role)).xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = workbookFileName(report);
  a.click();
  URL.revokeObjectURL(url);
}
