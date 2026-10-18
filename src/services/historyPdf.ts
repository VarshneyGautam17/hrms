import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { paiseToRupees } from '../utils/currency';
// ?inline embeds the image as data: jsPDF needs the bytes, not a link to the file.
import logoDataUrl from '../assets/deepak-electricals-logo.jpg?inline';
import { formatDisplayPeriod } from '../utils/dates';
import { dayStatusLabel, eventLabel, groupByMonth, totalsOf, type HistoryDay, type HistoryRecord } from './historyService';

// Landscape A4, in points.
const PAGE_W = 842;
const PAGE_H = 595;
const LEFT = 36;
const RIGHT = PAGE_W - 36;
const BOTTOM = PAGE_H - 40;
const ROW_H = 18;
/** Day-by-day rows are a little shorter so a whole 31-day month fits on one page. */
const DAY_ROW_H = 14;

const BORDER: [number, number, number] = [226, 232, 240];
const HEADER_FILL: [number, number, number] = [238, 242, 255];
const ZEBRA_FILL: [number, number, number] = [248, 250, 252];
const TOTAL_FILL: [number, number, number] = [241, 245, 249];

interface Column<T> {
  title: string;
  width: number;
  align: 'left' | 'right' | 'center';
  value: (row: T) => string;
}

/** Plain "10,000.00" — the header already says (Rs), and jsPDF's fonts can't draw ₹. */
function amount(paise: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paiseToRupees(paise));
}

const COLUMNS: Column<HistoryRecord>[] = [
  { title: 'Employee', width: 140, align: 'left', value: (r) => `${r.employee.name} (${r.employee.employeeCode})` },
  { title: 'Present', width: 46, align: 'center', value: (r) => String(r.attendance.present) },
  { title: 'Half Day', width: 46, align: 'center', value: (r) => String(r.attendance.halfDay) },
  { title: 'Absent', width: 46, align: 'center', value: (r) => String(r.attendance.absent) },
  { title: 'Not Marked', width: 54, align: 'center', value: (r) => String(r.attendance.notMarked) },
  { title: 'Weekly Off', width: 52, align: 'center', value: (r) => String(r.attendance.weeklyOff) },
  { title: 'Worked Off', width: 52, align: 'center', value: (r) => String(r.attendance.workedOnOff) },
  { title: 'Paid Days', width: 50, align: 'center', value: (r) => String(r.attendance.paidDays) },
  { title: 'Adv. Given (Rs)', width: 70, align: 'right', value: (r) => amount(r.advanceGivenPaise) },
  { title: 'Adv. Returned (Rs)', width: 86, align: 'right', value: (r) => amount(r.advanceReturnedPaise) },
  { title: 'Salary Paid (Rs)', width: 76, align: 'right', value: (r) => amount(r.salaryPaidPaise) },
  { title: 'Status', width: 52, align: 'center', value: (r) => (r.finalization ? 'Finalized' : 'Open') },
];

const sumEvents = (day: HistoryDay, kind: HistoryDay['events'][number]['kind']) => {
  const total = day.events.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.amountPaise, 0);
  return total > 0 ? amount(total) : '';
};

const DAY_COLUMNS: Column<HistoryDay>[] = [
  { title: 'Date', width: 62, align: 'left', value: (d) => format(parseISO(d.date), 'dd MMM yyyy') },
  { title: 'Day', width: 34, align: 'left', value: (d) => format(parseISO(d.date), 'EEE') },
  { title: 'Attendance', width: 120, align: 'left', value: (d) => dayStatusLabel(d) },
  { title: 'Adv. Given (Rs)', width: 80, align: 'right', value: (d) => sumEvents(d, 'ADVANCE_GIVEN') },
  { title: 'Adv. Returned (Rs)', width: 90, align: 'right', value: (d) => sumEvents(d, 'ADVANCE_RETURNED') },
  { title: 'Salary Paid (Rs)', width: 80, align: 'right', value: (d) => sumEvents(d, 'SALARY_PAID') },
  {
    title: 'Details / Notes',
    width: 304,
    align: 'left',
    value: (d) =>
      [
        ...d.events.map((e) =>
          [eventLabel(e), e.method && e.method !== 'Salary' ? e.method : null, e.notes].filter(Boolean).join(' - '),
        ),
        d.note ? `Note: ${d.note}` : null,
      ]
        .filter(Boolean)
        .join('; '),
  },
];

/**
 * Builds the History PDF: one table per month (newest first) for exactly the
 * records passed in — i.e. whatever the History page's filters show.
 * `filterSummary` is printed under the title so the reader knows what was
 * included.
 */
export function buildHistoryPdf(
  records: HistoryRecord[],
  filterSummary: string,
  createdAt: Date,
  options: { includeDays: boolean } = { includeDays: true },
  doc: jsPDF = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' }),
): jsPDF {
  let y = 48;

  const font = (style: 'normal' | 'bold', size: number, gray = 20) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(gray);
  };

  /** Cuts text down with "…" so it never spills into the next column. */
  const fit = (text: string, width: number) => {
    if (doc.getTextWidth(text) <= width) return text;
    let cut = text;
    while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
    return `${cut}…`;
  };

  const drawCells = (
    columns: { width: number; align: 'left' | 'right' | 'center' }[],
    cells: string[],
    style: 'normal' | 'bold',
    fill?: [number, number, number],
    rowH = ROW_H,
  ) => {
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(LEFT, y, RIGHT - LEFT, rowH, 'F');
    }
    font(style, rowH < ROW_H ? 7.5 : 8);
    let x = LEFT;
    columns.forEach((col, i) => {
      const text = fit(cells[i], col.width - 8);
      const textX = col.align === 'left' ? x + 4 : col.align === 'right' ? x + col.width - 4 : x + col.width / 2;
      doc.text(text, textX, y + rowH * 0.66, { align: col.align });
      x += col.width;
    });
    doc.setDrawColor(...BORDER);
    doc.line(LEFT, y + rowH, RIGHT, y + rowH);
    y += rowH;
  };

  const headerRow = () => drawCells(COLUMNS, COLUMNS.map((c) => c.title), 'bold', HEADER_FILL);
  const dayHeaderRow = () => drawCells(DAY_COLUMNS, DAY_COLUMNS.map((c) => c.title), 'bold', HEADER_FILL, DAY_ROW_H);

  const newPage = () => {
    doc.addPage();
    y = 40;
  };

  // Title block: logo on the left, title and filters beside it.
  doc.addImage(logoDataUrl, 'JPEG', LEFT, y - 26, 42, 42);
  const titleX = LEFT + 52;
  font('bold', 16);
  doc.text('History', titleX, y);
  font('normal', 9, 100);
  doc.text(`Downloaded on ${format(createdAt, 'dd MMM yyyy, hh:mm a')}`, RIGHT, y, { align: 'right' });
  y += 16;
  doc.text(filterSummary, titleX, y);
  y += 14;
  const totals = totalsOf(records);
  font('bold', 9, 40);
  doc.text(
    `Total salary paid: Rs. ${amount(totals.salaryPaidPaise)}   ·   Advance given: Rs. ${amount(totals.advanceGivenPaise)}   ·   Advance returned: Rs. ${amount(totals.advanceReturnedPaise)}`,
    LEFT,
    y,
  );
  y += 18;

  if (records.length === 0) {
    font('normal', 10, 100);
    doc.text('No records match the selected filters.', LEFT, y + 10);
  }

  for (const group of groupByMonth(records)) {
    // Keep a month's heading together with its table header and first row.
    if (y + 24 + ROW_H * 2 > BOTTOM) newPage();
    y += 8;
    font('bold', 11);
    doc.text(`${formatDisplayPeriod(group.period)}  (${group.records.length} employee${group.records.length === 1 ? '' : 's'})`, LEFT, y);
    y += 8;
    headerRow();

    group.records.forEach((record, i) => {
      if (y + ROW_H > BOTTOM) {
        newPage();
        font('bold', 9, 100);
        doc.text(`${formatDisplayPeriod(group.period)} (continued)`, LEFT, y);
        y += 6;
        headerRow();
      }
      drawCells(
        COLUMNS,
        COLUMNS.map((c) => c.value(record)),
        'normal',
        i % 2 === 1 ? ZEBRA_FILL : undefined,
      );
    });

    if (y + ROW_H > BOTTOM) {
      newPage();
      headerRow();
    }
    const monthTotals = totalsOf(group.records);
    const totalCells = COLUMNS.map(() => '');
    totalCells[0] = 'Month total';
    totalCells[8] = amount(monthTotals.advanceGivenPaise);
    totalCells[9] = amount(monthTotals.advanceReturnedPaise);
    totalCells[10] = amount(monthTotals.salaryPaidPaise);
    drawCells(COLUMNS, totalCells, 'bold', TOTAL_FILL);
    y += 10;
  }

  // Day-by-day tables: every date of every employee-month above, on fresh pages.
  if (options.includeDays && records.length > 0) {
    newPage();
    font('bold', 14);
    doc.text('Day-by-Day Details', LEFT, y);
    y += 8;

    for (const record of records) {
      if (y + 30 + DAY_ROW_H * 3 > BOTTOM) newPage();
      const heading = `${record.employee.name} (${record.employee.employeeCode})  -  ${formatDisplayPeriod(record.period)}`;
      y += 16;
      font('bold', 10);
      doc.text(heading, LEFT, y);
      font('normal', 8, 100);
      const a = record.attendance;
      doc.text(
        `Present ${a.present} · Half Day ${a.halfDay} · Absent ${a.absent} · Not Marked ${a.notMarked} · Weekly Off ${a.weeklyOff} · Paid Days ${a.paidDays}`,
        RIGHT,
        y,
        { align: 'right' },
      );
      y += 6;
      dayHeaderRow();

      record.days.forEach((day, i) => {
        if (y + DAY_ROW_H > BOTTOM) {
          newPage();
          font('bold', 9, 100);
          doc.text(`${heading} (continued)`, LEFT, y);
          y += 6;
          dayHeaderRow();
        }
        drawCells(
          DAY_COLUMNS,
          DAY_COLUMNS.map((c) => c.value(day)),
          'normal',
          i % 2 === 1 ? ZEBRA_FILL : undefined,
          DAY_ROW_H,
        );
      });
    }
  }

  // Page numbers, once the page count is known.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    font('normal', 8, 150);
    doc.text(`Page ${page} of ${pages}`, RIGHT, PAGE_H - 20, { align: 'right' });
  }

  return doc;
}

/** e.g. "History_Ramesh-Kumar_Oct-2026_2026-10-18_09-15.pdf" or "History_All-Employees_All-Months_….pdf" */
export function historyFileName(employeeLabel: string, period: string, createdAt: Date): string {
  const safe = (text: string) =>
    text
      .trim()
      .replace(/[\\/:*?"<>|()]+/g, '')
      .replace(/\s+/g, '-');
  const month = period === 'ALL' ? 'All-Months' : format(new Date(`${period}-01T00:00:00`), 'MMM-yyyy');
  return `History_${safe(employeeLabel)}_${month}_${format(createdAt, 'yyyy-MM-dd_HH-mm')}.pdf`;
}
