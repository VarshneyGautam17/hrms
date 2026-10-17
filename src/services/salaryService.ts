import { getEmployee } from '../db/repositories/employees';
import { listAttendanceForEmployeeInRange } from '../db/repositories/attendance';
import { listAdvancesForEmployee, computeOutstandingBalance, recordRepayment } from '../db/repositories/advances';
import { listPaymentsForEmployeePeriod, sumPayments, addSalaryPayment } from '../db/repositories/payments';
import { getSettings } from '../db/repositories/settings';
import { getFinalization, createFinalization } from '../db/repositories/salaryFinalizations';
import { summarizeAttendanceForEmployee, type DayClassification } from './attendanceSummary';
import { calculateSalary } from './salaryCalculator';
import type { Employee, SalaryCalculationSnapshot } from '../types';
import { daysInPeriod, totalDaysInPeriod, todayISO } from '../utils/dates';

export interface SalarySlip {
  employee: Employee;
  period: string;
  days: DayClassification[];
  snapshot: SalaryCalculationSnapshot;
  /** True once this employee/period has been finalized — the snapshot above is then the frozen, permanent record, never recomputed. */
  finalized: boolean;
  finalizedAt: string | null;
}

/**
 * Computes a salary slip for one employee/period.
 *
 * If the period was already finalized, this returns the exact frozen
 * snapshot from that finalization — never recomputed — because by then the
 * advance ledger and payment history have already been mutated by that same
 * finalization, and recomputing live would double-count what was already
 * paid/recovered. Otherwise it computes fresh from current attendance,
 * advances and settings every time, same as before.
 */
export async function computeSalarySlip(
  employeeId: string,
  period: string,
  otherDeductionPaise = 0,
  advanceRepaymentPaise?: number,
): Promise<SalarySlip> {
  const employee = await getEmployee(employeeId);
  if (!employee) throw new Error('Employee not found.');

  const existingFinalization = await getFinalization(employeeId, period);
  if (existingFinalization) {
    return {
      employee,
      period,
      days: [],
      snapshot: existingFinalization.snapshot,
      finalized: true,
      finalizedAt: existingFinalization.finalizedAt,
    };
  }

  const settings = await getSettings();
  const [firstDate, lastDate] = [daysInPeriod(period)[0], daysInPeriod(period).slice(-1)[0]];

  const [attendance, advances, payments] = await Promise.all([
    listAttendanceForEmployeeInRange(employeeId, firstDate, lastDate),
    listAdvancesForEmployee(employeeId),
    listPaymentsForEmployeePeriod(employeeId, period),
  ]);

  const { days, counts } = summarizeAttendanceForEmployee(employee, period, attendance, settings.weeklyOffDay);

  // Salary divisor is always the actual number of days in that calendar month.
  const divisor = totalDaysInPeriod(period);

  const advancesUpToPeriodEnd = advances.filter((tx) => tx.date <= lastDate);
  const outstandingBeforePaise = computeOutstandingBalance(advancesUpToPeriodEnd);

  const snapshot = calculateSalary({
    monthlySalaryPaise: employee.monthlySalaryPaise,
    divisor,
    totalDaysInMonth: totalDaysInPeriod(period),
    presentDays: counts.presentDays,
    halfDays: counts.halfDays,
    unpaidAbsentDays: counts.unpaidAbsentDays,
    notMarkedDays: counts.notMarkedDays,
    paidWeeklyOffDays: counts.paidWeeklyOffDays,
    otherDeductionPaise,
    alreadyPaidPaise: sumPayments(payments),
    outstandingAdvanceBeforePaise: outstandingBeforePaise,
    advanceRepaymentPaise,
  });

  return { employee, period, days, snapshot, finalized: false, finalizedAt: null };
}

/**
 * Permanently locks in a salary slip: records the real advance repayment (if
 * any was recovered), records the salary payment, and freezes the exact
 * snapshot so it can never silently change or be double-counted later.
 * One-way — throws if this employee/period was already finalized.
 */
export async function finalizeSalary(employeeId: string, slip: SalarySlip, emailedTo: string | null) {
  if (slip.finalized) {
    throw new Error('This period was already finalized.');
  }

  const date = todayISO();
  const repayment =
    slip.snapshot.advanceRecoveredPaise > 0
      ? await recordRepayment({
          employeeId,
          date,
          amountPaise: slip.snapshot.advanceRecoveredPaise,
          notes: `Recovered via salary finalization for ${slip.period}`,
        })
      : null;

  const payment = await addSalaryPayment({
    employeeId,
    date,
    amountPaise: slip.snapshot.finalPayablePaise,
    method: 'Salary',
    period: slip.period,
    notes: 'Finalized salary payment',
  });

  return createFinalization({
    employeeId,
    period: slip.period,
    snapshot: slip.snapshot,
    advanceTransactionId: repayment?.id ?? null,
    paymentId: payment.id,
    emailedTo,
  });
}
