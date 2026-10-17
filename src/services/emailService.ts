import { setDoc } from 'firebase/firestore';
import { userDoc } from '../firebase/paths';
import { newId } from '../utils/id';
import { formatPaiseAsINR } from '../utils/currency';
import { formatDisplayPeriod, formatDisplayDate, todayISO } from '../utils/dates';
import type { SalarySlip } from './salaryService';

const COLLECTION = 'mail';

/**
 * Queues a salary-slip email by writing a document to the `mail` collection.
 * This app has no backend of its own, so delivery depends on the Firebase
 * "Trigger Email from Firestore" extension (or an equivalent) being installed
 * and configured with SMTP credentials on this Firebase project — this
 * function only writes the record; it does not send anything itself.
 */
export async function queueSalaryEmail(to: string, slip: SalarySlip): Promise<void> {
  const s = slip.snapshot;
  const subject = `Salary Slip — ${slip.employee.name} — ${formatDisplayPeriod(slip.period)}`;

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:${strong ? '#111' : '#555'};font-weight:${strong ? '600' : '400'}">${label}</td><td style="padding:4px 0;text-align:right;color:${strong ? '#111' : '#222'};font-weight:${strong ? '600' : '400'}">${value}</td></tr>`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:0">Salary Slip</h2>
      <p style="color:#555;margin-top:4px">${formatDisplayPeriod(slip.period)}</p>
      <p style="margin:12px 0"><strong>${slip.employee.name}</strong> (${slip.employee.employeeCode})${
        slip.employee.department ? ` · ${slip.employee.department}` : ''
      }</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${row('Attendance', `${s.presentDays} Present · ${s.halfDays} Half Day · ${s.unpaidAbsentDays} Absent · ${s.notMarkedDays} Not Marked · ${s.paidWeeklyOffDays} Weekly Off`)}
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0" />
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${row('Monthly Salary', formatPaiseAsINR(s.monthlySalaryPaise))}
        ${row('Attendance Deduction', `− ${formatPaiseAsINR(s.attendanceDeductionPaise)}`)}
        ${row('Other Deduction', `− ${formatPaiseAsINR(s.otherDeductionPaise)}`)}
        ${row('Earned Salary', formatPaiseAsINR(s.earnedSalaryPaise), true)}
        ${row('Already Paid', `− ${formatPaiseAsINR(s.alreadyPaidPaise)}`)}
        ${row('Advance Recovered', `− ${formatPaiseAsINR(s.advanceRecoveredPaise)}`)}
        ${row('Advance Carried Forward', formatPaiseAsINR(s.advanceCarriedForwardPaise))}
      </table>
      <div style="margin-top:16px;padding:10px 14px;background:#f1f5f9;border-radius:8px;display:flex;justify-content:space-between">
        <strong>Final Payable</strong>
        <strong style="color:#15803d">${formatPaiseAsINR(s.finalPayablePaise)}</strong>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">Finalized on ${formatDisplayDate(todayISO())} via Deepak Electricals HRMS.</p>
    </div>
  `;

  const text = [
    `Salary Slip — ${slip.employee.name} (${slip.employee.employeeCode}) — ${formatDisplayPeriod(slip.period)}`,
    `Monthly Salary: ${formatPaiseAsINR(s.monthlySalaryPaise)}`,
    `Attendance Deduction: -${formatPaiseAsINR(s.attendanceDeductionPaise)}`,
    `Other Deduction: -${formatPaiseAsINR(s.otherDeductionPaise)}`,
    `Earned Salary: ${formatPaiseAsINR(s.earnedSalaryPaise)}`,
    `Already Paid: -${formatPaiseAsINR(s.alreadyPaidPaise)}`,
    `Advance Recovered: -${formatPaiseAsINR(s.advanceRecoveredPaise)}`,
    `Advance Carried Forward: ${formatPaiseAsINR(s.advanceCarriedForwardPaise)}`,
    `Final Payable: ${formatPaiseAsINR(s.finalPayablePaise)}`,
  ].join('\n');

  await setDoc(userDoc(COLLECTION, newId()), {
    to: [to],
    message: { subject, text, html },
    createdAt: new Date().toISOString(),
  });
}
