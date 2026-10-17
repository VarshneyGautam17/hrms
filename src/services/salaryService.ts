import { getEmployee } from '../db/repositories/employees';
import { listAttendanceForEmployeeInRange } from '../db/repositories/attendance';
import { listAdvancesForEmployee, computeOutstandingBalance } from '../db/repositories/advances';
import { listPaymentsForEmployeePeriod, sumPayments } from '../db/repositories/payments';
import { getSettings } from '../db/repositories/settings';
import { summarizeAttendanceForEmployee, type DayClassification } from './attendanceSummary';
import { calculateSalary } from './salaryCalculator';
import type { Employee, SalaryCalculationSnapshot } from '../types';
import { daysInPeriod, totalDaysInPeriod } from '../utils/dates';

export interface SalarySlip {
  employee: Employee;
  period: string;
  days: DayClassification[];
  snapshot: SalaryCalculationSnapshot;
}

/**
 * Computes a salary slip for one employee/period, fresh from current
 * attendance, advances and settings every time — there is no "finalize"
 * step and nothing is persisted. Printing a slip just prints this live
 * calculation.
 */
export async function computeSalarySlip(employeeId: string, period: string, otherDeductionPaise = 0): Promise<SalarySlip> {
  const employee = await getEmployee(employeeId);
  if (!employee) throw new Error('Employee not found.');

  const settings = await getSettings();
  const [firstDate, lastDate] = [daysInPeriod(period)[0], daysInPeriod(period).slice(-1)[0]];

  const [attendance, advances, payments] = await Promise.all([
    listAttendanceForEmployeeInRange(employeeId, firstDate, lastDate),
    listAdvancesForEmployee(employeeId),
    listPaymentsForEmployeePeriod(employeeId, period),
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
  });

  return { employee, period, days, snapshot };
}
