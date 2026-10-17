import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { createEmployee } from '../db/repositories/employees';
import { setAttendanceStatus } from '../db/repositories/attendance';
import { addAdvanceTransaction } from '../db/repositories/advances';
import { updateSettings } from '../db/repositories/settings';
import { computeSalarySlip } from '../services/salaryService';
import { daysInPeriod, weekdayOf } from '../utils/dates';

const PERIOD = '2026-02'; // 28 days

async function clearAll() {
  await db.transaction(
    'rw',
    [db.employees, db.attendance, db.advanceTransactions, db.salaryPayments, db.settings, db.appMetadata],
    async () => {
      await Promise.all([
        db.employees.clear(),
        db.attendance.clear(),
        db.advanceTransactions.clear(),
        db.salaryPayments.clear(),
        db.settings.clear(),
        db.appMetadata.clear(),
      ]);
    },
  );
}

beforeEach(async () => {
  await clearAll();
  await updateSettings({
    salaryDivisorMode: 'FIXED',
    fixedDivisor: 26,
  });
});

async function markPresentForAllDays(employeeId: string, period: string, excludeDates: string[] = []) {
  for (const date of daysInPeriod(period)) {
    if (excludeDates.includes(date)) continue;
    await setAttendanceStatus(employeeId, date, 'PRESENT');
  }
}

describe('salaryService', () => {
  it('does not deduct salary for the fixed weekly off (every Monday)', async () => {
    const employee = await createEmployee({
      employeeCode: 'E1',
      name: 'Asha',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 26_000_00,
    });
    const mondays = daysInPeriod(PERIOD).filter((d) => weekdayOf(d) === 1);
    await markPresentForAllDays(employee.id, PERIOD, mondays);

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.paidWeeklyOffDays).toBe(mondays.length);
    expect(slip.snapshot.attendanceDeductionPaise).toBe(0);
    expect(slip.snapshot.finalPayablePaise).toBe(26_000_00);
  });

  it('recovers the maximum possible advance by default', async () => {
    const employee = await createEmployee({
      employeeCode: 'E2',
      name: 'Rahul',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 26_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-05', type: 'ADVANCE', amountPaise: 5_000_00 });

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.advanceRecoveredPaise).toBe(5_000_00);
    expect(slip.snapshot.finalPayablePaise).toBe(26_000_00 - 5_000_00);
  });

  it('carries forward an advance balance that exceeds the amount available for recovery', async () => {
    const employee = await createEmployee({
      employeeCode: 'E3',
      name: 'Priya',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 10_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-01', type: 'ADVANCE', amountPaise: 15_000_00 });

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.finalPayablePaise).toBe(0);
    expect(slip.snapshot.advanceCarriedForwardPaise).toBe(5_000_00);
  });

  it('excludes days outside the employment window for a mid-month joiner', async () => {
    const employee = await createEmployee({
      employeeCode: 'E4',
      name: 'Mid Joiner',
      joiningDate: '2026-02-15',
      monthlySalaryPaise: 26_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);

    const slip = await computeSalarySlip(employee.id, PERIOD);
    const outsideCount = slip.days.filter((d) => d.source === 'OUTSIDE_EMPLOYMENT').length;
    expect(outsideCount).toBe(14); // Feb 1-14
  });
});
