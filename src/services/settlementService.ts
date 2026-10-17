import { db } from '../db/database';
import { getEmployee } from '../db/repositories/employees';
import { listAttendanceForEmployeeInRange } from '../db/repositories/attendance';
import { listAdvancesForEmployee, computeOutstandingBalance, addAdvanceTransaction } from '../db/repositories/advances';
import { listPaymentsForEmployeePeriod, sumPayments } from '../db/repositories/payments';
import { getSettlement } from '../db/repositories/settlements';
import { getSettings } from '../db/repositories/settings';
import { summarizeAttendanceForEmployee, type DayClassification } from './attendanceSummary';
import { calculateSalary } from './salaryCalculator';
import type { AppSettings, Employee, SalaryCalculationSnapshot, SalarySettlement } from '../types';
import { daysInPeriod, totalDaysInPeriod } from '../utils/dates';
import { newId } from '../utils/id';

export interface SettlementPreview {
  employee: Employee;
  period: string;
  days: DayClassification[];
  snapshot: SalaryCalculationSnapshot;
  alreadyFinalized: boolean;
}

async function computePreview(
  employeeId: string,
  period: string,
  settings: AppSettings,
  otherDeductionPaise: number,
  advanceDeductionRequestedPaise?: number,
): Promise<SettlementPreview> {
  const employee = await getEmployee(employeeId);
  if (!employee) throw new Error('Employee not found.');

  const [firstDate, lastDate] = [daysInPeriod(period)[0], daysInPeriod(period).slice(-1)[0]];

  const [attendance, advances, payments, existingSettlement] = await Promise.all([
    listAttendanceForEmployeeInRange(employeeId, firstDate, lastDate),
    listAdvancesForEmployee(employeeId),
    listPaymentsForEmployeePeriod(employeeId, period),
    getSettlement(employeeId, period),
  ]);

  const { days, counts } = summarizeAttendanceForEmployee(employee, period, attendance);

  const divisor = settings.salaryDivisorMode === 'FIXED' ? settings.fixedDivisor : totalDaysInPeriod(period);

  const advancesUpToPeriodEnd = advances.filter((tx) => tx.date <= lastDate);
  const outstandingBeforePaise = computeOutstandingBalance(advancesUpToPeriodEnd);

  const snapshot = calculateSalary({
    monthlySalaryPaise: employee.monthlySalaryPaise,
    divisor,
    totalDaysInMonth: totalDaysInPeriod(period),
    presentDays: counts.presentDays,
    halfDays: counts.halfDays,
    unpaidAbsentDays: counts.unpaidAbsentDays,
    paidWeeklyOffDays: counts.paidWeeklyOffDays,
    otherDeductionPaise,
    alreadyPaidPaise: sumPayments(payments),
    outstandingAdvanceBeforePaise: outstandingBeforePaise,
    advanceDeductionRequestedPaise,
  });

  return {
    employee,
    period,
    days,
    snapshot,
    alreadyFinalized: existingSettlement?.status === 'FINALIZED',
  };
}

export async function previewSettlement(
  employeeId: string,
  period: string,
  otherDeductionPaise = 0,
  advanceDeductionRequestedPaise?: number,
): Promise<SettlementPreview> {
  const settings = await getSettings();
  return computePreview(employeeId, period, settings, otherDeductionPaise, advanceDeductionRequestedPaise);
}

export interface FinalizeResult {
  settlement: SalarySettlement;
}

/**
 * Finalizes a settlement inside a single IndexedDB transaction: recomputes
 * the snapshot fresh, writes the (at most one) advance recovery transaction,
 * and persists the settlement row. The unique [employeeId+period] index on
 * salarySettlements makes a duplicate finalize fail atomically — nothing is
 * partially written, so repeated clicks cannot double-recover an advance.
 */
export async function finalizeSettlement(
  employeeId: string,
  period: string,
  otherDeductionPaise = 0,
  advanceDeductionRequestedPaise?: number,
): Promise<FinalizeResult> {
  const settings = await getSettings();

  return db.transaction(
    'rw',
    [db.employees, db.attendance, db.advanceTransactions, db.salaryPayments, db.salarySettlements],
    async () => {
      const existing = await getSettlement(employeeId, period);
      if (existing?.status === 'FINALIZED') {
        throw new Error(`Salary for this employee is already finalized for ${period}.`);
      }

      const preview = await computePreview(employeeId, period, settings, otherDeductionPaise, advanceDeductionRequestedPaise);

      if (preview.snapshot.advanceRecoveredPaise > 0) {
        await addAdvanceTransaction({
          employeeId,
          date: daysInPeriod(period).slice(-1)[0],
          type: 'REPAYMENT',
          amountPaise: preview.snapshot.advanceRecoveredPaise,
          notes: `Recovered via salary settlement for ${period}`,
        });
      }

      const now = new Date().toISOString();
      const settlement: SalarySettlement = {
        id: existing?.id ?? newId(),
        employeeId,
        period,
        status: 'FINALIZED',
        grossPaise: preview.snapshot.monthlySalaryPaise,
        attendanceDeductionPaise: preview.snapshot.attendanceDeductionPaise,
        otherDeductionPaise: preview.snapshot.otherDeductionPaise,
        advanceRecoveryPaise: preview.snapshot.advanceRecoveredPaise,
        paidPaise: preview.snapshot.alreadyPaidPaise,
        payablePaise: preview.snapshot.finalPayablePaise,
        carriedForwardPaise: preview.snapshot.advanceCarriedForwardPaise,
        calculationSnapshot: preview.snapshot,
        finalizedAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      await db.salarySettlements.put(settlement);
      return { settlement };
    },
  );
}
