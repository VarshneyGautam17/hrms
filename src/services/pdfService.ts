import { jsPDF } from 'jspdf';
import { formatPaiseAsRs } from '../utils/currency';
// ?inline embeds the image as data: jsPDF needs the bytes, not a link to the file.
import logoDataUrl from '../assets/deepak-electricals-logo.jpg?inline';
import { format } from 'date-fns';
import { formatDisplayPeriod, formatDisplayDate } from '../utils/dates';
import type { SalarySlip } from './salaryService';
import { paidDaysOf } from './salaryCalculator';

const LEFT = 48;
const RIGHT = 547;
const TEXT = 20;
const MUTED = 100;
const GREEN: [number, number, number] = [21, 128, 61];
const BORDER: [number, number, number] = [226, 232, 240];
const FILL: [number, number, number] = [241, 245, 249];

/** Builds the slip PDF and triggers a browser download of it. */
export function downloadSalarySlipPdf(slip: SalarySlip): void {
  const downloadedAt = new Date();
  buildSalarySlipPdf(slip, downloadedAt, 'Downloaded').save(salarySlipFileName(slip, downloadedAt));
}

/**
 * Prints the slip PDF — the exact same one-page document as the download —
 * instead of the web page, so no page layout, scrollbars or buttons end up
 * on paper. The PDF is loaded into a hidden frame and that frame is printed.
 */
export function printSalarySlip(slip: SalarySlip): void {
  const doc = buildSalarySlipPdf(slip, new Date(), 'Printed');
  const url = URL.createObjectURL(doc.output('blob'));

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some browsers won't print a PDF inside a frame; open it in a tab to print from there.
      window.open(url, '_blank');
    }
    // Leave time for the print dialog to take its copy before cleaning up.
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
}

/**
 * Builds a one-page salary slip PDF. Amounts use "Rs." rather than "₹"
 * because jsPDF's built-in fonts can't draw the rupee sign.
 */
export function buildSalarySlipPdf(
  slip: SalarySlip,
  createdAt: Date,
  action: 'Downloaded' | 'Printed',
  doc: jsPDF = new jsPDF({ unit: 'pt', format: 'a4' }),
): jsPDF {
  const s = slip.snapshot;
  let y = 52;

  const font = (style: 'normal' | 'bold', size: number, gray: number | [number, number, number] = TEXT) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    if (Array.isArray(gray)) doc.setTextColor(...gray);
    else doc.setTextColor(gray);
  };

  const sectionHeading = (title: string) => {
    y += 10;
    doc.setFillColor(...FILL);
    doc.rect(LEFT, y - 12, RIGHT - LEFT, 18, 'F');
    font('bold', 9, MUTED);
    doc.text(title.toUpperCase(), LEFT + 8, y);
    y += 20;
  };

  const row = (label: string, value: string, opts: { bold?: boolean; line?: boolean } = {}) => {
    if (opts.line) {
      doc.setDrawColor(...BORDER);
      doc.line(LEFT, y - 11, RIGHT, y - 11);
    }
    font(opts.bold ? 'bold' : 'normal', 10, opts.bold ? TEXT : 85);
    doc.text(label, LEFT + 8, y);
    font(opts.bold ? 'bold' : 'normal', 10);
    doc.text(value, RIGHT - 8, y, { align: 'right' });
    y += 17;
  };

  // Header: logo on the left, title and employee beside it.
  doc.addImage(logoDataUrl, 'JPEG', LEFT, y - 30, 48, 48);
  const titleX = LEFT + 58;
  font('bold', 18);
  doc.text('Salary Slip', titleX, y);
  font('normal', 11, MUTED);
  doc.text(formatDisplayPeriod(slip.period), RIGHT, y, { align: 'right' });
  y += 18;
  font('bold', 11);
  doc.text(`${slip.employee.name} (${slip.employee.employeeCode})`, titleX, y);
  font('normal', 9, MUTED);
  doc.text(`${action} on ${format(createdAt, 'dd MMM yyyy, hh:mm a')}`, RIGHT, y, { align: 'right' });
  y += 14;
  if (slip.finalized) {
    font('bold', 9, GREEN);
    doc.text(`FINALIZED${slip.finalizedAt ? ` ON ${formatDisplayDate(slip.finalizedAt.slice(0, 10))}` : ''}`, RIGHT, y, {
      align: 'right',
    });
  }
  y += 10;
  doc.setDrawColor(...BORDER);
  doc.line(LEFT, y, RIGHT, y);
  y += 10;

  sectionHeading('Employee');
  row('Name', slip.employee.name);
  row('Employee ID', slip.employee.employeeCode);
  row('Department', slip.employee.department ?? '-');

  sectionHeading('Attendance');
  row('Present', String(s.presentDays));
  row('Half Day', String(s.halfDays));
  row('Absent', String(s.unpaidAbsentDays));
  row('Not Marked', String(s.notMarkedDays));
  row('Weekly Off (paid)', String(s.paidWeeklyOffDays));
  row('Worked on Weekly Off', String(s.weeklyOffWorkedDays ?? 0));
  row('Paid Days', `${paidDaysOf(s)} of ${s.totalDaysInMonth}`, { bold: true, line: true });

  sectionHeading('Earnings');
  row('Monthly Salary', formatPaiseAsRs(s.monthlySalaryPaise));
  row(`Per Day Rate (Monthly / ${s.divisor} days)`, formatPaiseAsRs(Math.round(s.dailyRatePaise)));
  const weeklyOffExtraPaise = s.weeklyOffExtraPaise ?? 0;
  row(
    `Unpaid Days: ${s.unpaidDayEquivalents} (Absent, Not Marked, 1/2 of Half Days)`,
    `${formatPaiseAsRs(s.attendanceDeductionPaise)} not paid`,
  );
  row('Salary for Paid Days (Per Day Rate x Paid Days)', formatPaiseAsRs(s.earnedSalaryPaise - weeklyOffExtraPaise));
  row(`Extra: Worked on Weekly Off (${s.weeklyOffWorkedDays ?? 0} days)`, `+ ${formatPaiseAsRs(weeklyOffExtraPaise)}`);
  row('Earned Salary', formatPaiseAsRs(s.earnedSalaryPaise), { bold: true, line: true });

  const totalDeductionsPaise = s.otherDeductionPaise + s.alreadyPaidPaise + s.advanceRecoveredPaise;
  sectionHeading('Deductions');
  row('Other Deduction', formatPaiseAsRs(s.otherDeductionPaise));
  row('Already Paid', formatPaiseAsRs(s.alreadyPaidPaise));
  row('Advance Cut from Salary', formatPaiseAsRs(s.advanceRecoveredPaise));
  row('Total Deductions', formatPaiseAsRs(totalDeductionsPaise), { bold: true, line: true });

  // Final payable
  y += 6;
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(LEFT, y, RIGHT - LEFT, 36, 6, 6, 'F');
  font('bold', 12);
  doc.text('Final Payable', LEFT + 12, y + 23);
  font('bold', 14, GREEN);
  doc.text(formatPaiseAsRs(s.finalPayablePaise), RIGHT - 12, y + 23, { align: 'right' });
  y += 50;

  sectionHeading('Advance');
  row('Advance Pending (before this salary)', formatPaiseAsRs(s.outstandingAdvanceBeforePaise));
  row('Advance Cut from Salary', formatPaiseAsRs(s.advanceRecoveredPaise));
  row('Advance Still Pending', formatPaiseAsRs(s.advanceCarriedForwardPaise), { bold: true, line: true });

  return doc;
}

/** e.g. "Salary-Slip_Ramesh-Kumar_E001_Oct-2026_2026-10-18_09-15.pdf" */
export function salarySlipFileName(slip: SalarySlip, downloadedAt: Date): string {
  // Strip characters that aren't allowed (or are awkward) in file names.
  const safe = (text: string) =>
    text
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-');
  const month = format(new Date(`${slip.period}-01T00:00:00`), 'MMM-yyyy');
  return `Salary-Slip_${safe(slip.employee.name)}_${safe(slip.employee.employeeCode)}_${month}_${format(downloadedAt, 'yyyy-MM-dd_HH-mm')}.pdf`;
}
