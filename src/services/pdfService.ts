import { jsPDF } from 'jspdf';
import { formatPaiseAsINR } from '../utils/currency';
import { formatDisplayPeriod, formatDisplayDate, todayISO } from '../utils/dates';
import type { SalarySlip } from './salaryService';

/** Builds a one-page salary slip PDF and triggers a browser download of it. */
export function downloadSalarySlipPdf(slip: SalarySlip): void {
  const s = slip.snapshot;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 48;
  const right = 547;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Salary Slip', left, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(formatDisplayPeriod(slip.period), left, y);
  if (slip.finalized) {
    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.text('FINALIZED', right, y, { align: 'right' });
  }
  y += 22;

  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, right, y);
  y += 20;

  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(85);
    doc.text(label, left, y);
    doc.setTextColor(20);
    doc.text(value, right, y, { align: 'right' });
    y += 16;
  };

  field('Employee Name', slip.employee.name);
  field('Employee Code', slip.employee.employeeCode);
  field('Department', slip.employee.department ?? '—');
  field(
    'Attendance',
    `${s.presentDays} Present / ${s.halfDays} Half Day / ${s.unpaidAbsentDays} Absent / ${s.notMarkedDays} Not Marked / ${s.paidWeeklyOffDays} Weekly Off`,
  );

  y += 4;
  doc.line(left, y, right, y);
  y += 20;

  field('Monthly Salary', formatPaiseAsINR(s.monthlySalaryPaise));
  field('Attendance Deduction', `- ${formatPaiseAsINR(s.attendanceDeductionPaise)}`);
  field('Other Deduction', `- ${formatPaiseAsINR(s.otherDeductionPaise)}`);
  doc.setFont('helvetica', 'bold');
  field('Earned Salary', formatPaiseAsINR(s.earnedSalaryPaise));
  doc.setFont('helvetica', 'normal');
  field('Already Paid', `- ${formatPaiseAsINR(s.alreadyPaidPaise)}`);
  field('Advance Recovered', `- ${formatPaiseAsINR(s.advanceRecoveredPaise)}`);
  field('Advance Carried Forward', formatPaiseAsINR(s.advanceCarriedForwardPaise));

  y += 8;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(left, y, right - left, 32, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text('Final Payable', left + 12, y + 21);
  doc.setTextColor(21, 128, 61);
  doc.text(formatPaiseAsINR(s.finalPayablePaise), right - 12, y + 21, { align: 'right' });
  y += 50;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${formatDisplayDate(todayISO())}`, right, y, { align: 'right' });

  const fileName = `Salary-Slip-${slip.employee.employeeCode}-${slip.period}.pdf`;
  doc.save(fileName);
}
