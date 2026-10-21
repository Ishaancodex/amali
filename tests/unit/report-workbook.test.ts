// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { buildSeed } from '@/seed';
import {
  buildReport,
  REPORT_AMENITIES,
  REPORT_SECTIONS,
  type Report,
} from '@/store/selectors/report';
import {
  buildWorkbook,
  reportSheets,
  sheetsForRole,
  workbookFileName,
} from '@/features/reports/workbook';
import type { ConsoleRole } from '@/types/demo';

const NOW = '2026-10-14T13:30:00.000Z';
const request = {
  from: '2026-09-14',
  to: '2026-10-13',
  amenities: [...REPORT_AMENITIES],
  towers: [],
  sections: [...REPORT_SECTIONS],
};
let state: ReturnType<typeof buildSeed>;
const reportFor = (role: ConsoleRole): Report => buildReport(state, request, role, undefined, NOW);

async function roundTrip(role: ConsoleRole) {
  const buffer = await (
    await buildWorkbook(reportSheets(reportFor(role), role))
  ).xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  return wb;
}
const headers = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as unknown[]).slice(1);

beforeAll(() => {
  state = buildSeed('amali-2026', NOW);
});

describe('Excel export — sheets and headers per role (snapshot)', () => {
  it('Community Manager: all eight sheets', async () => {
    const wb = await roundTrip('community_manager');
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      'Utilisation',
      'Peak hours',
      'Bookings',
      'No-shows',
      'Revenue',
      'Communications',
      'Work orders',
    ]);
    expect(Object.fromEntries(wb.worksheets.map((w) => [w.name, headers(w)]))).toEqual({
      Summary: ['Measure', 'Value'],
      Utilisation: ['Amenity', 'Measure', 'Value'],
      'Peak hours': ['Amenity', 'Day', 'Hour', 'Value'],
      Bookings: ['Date', 'Weekday', 'Bookings'],
      'No-shows': ['Amenity', 'Bookings', 'No-show rate', 'Late cancellation rate'],
      Revenue: ['Source', 'Amount'],
      Communications: ['Messages', 'Recipients', 'Delivered', 'Median minutes to read'],
      'Work orders': [
        'Work order',
        'Amenity',
        'Title',
        'Priority',
        'Created',
        'Resolved',
        'Within SLA',
      ],
    });
  });

  it('Amenity Supervisor: no Revenue, Bookings or Communications; only Pool, Gym and Padel', async () => {
    const wb = await roundTrip('amenity_supervisor');
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      'Utilisation',
      'Peak hours',
      'No-shows',
      'Work orders',
    ]);
    const amenities = new Set(wb.getWorksheet('Utilisation')!.getColumn(1).values.slice(2));
    expect(amenities).toEqual(new Set(['Padel', 'Adult Pool', 'Sky Gym']));
  });

  it('Call-centre Agent: no sheets at all (the export button is hidden)', () => {
    expect(sheetsForRole('call_centre')).toEqual([]);
  });

  it('formats: bold header, frozen first row, AED and percent formats, Dubai-time dates, file name', async () => {
    const wb = await roundTrip('community_manager');
    const revenue = wb.getWorksheet('Revenue')!;
    expect(revenue.getRow(1).font?.bold).toBe(true);
    expect(revenue.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(revenue.getCell('B2').numFmt).toBe('"AED" #,##0.00');
    expect(wb.getWorksheet('Utilisation')!.getCell('C2').numFmt).toBe('0.0%');
    const wo = wb.getWorksheet('Work orders')!;
    const created = wo.getCell('E2').value as Date;
    expect(created.getUTCHours()).toBe(9); // created 09:00 Dubai — written as Dubai wall-clock
    expect(workbookFileName(reportFor('community_manager'))).toBe(
      'amali-amenities-report_2026-09-14_2026-10-13.xlsx',
    );
  });
});
