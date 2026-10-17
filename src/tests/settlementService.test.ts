import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import { createEmployee } from '../db/repositories/employees';
import { setAttendanceStatus } from '../db/repositories/attendance';
import { addHoliday } from '../db/repositories/holidays';
import { addAdvanceTransaction, listAdvancesForEmployee, computeOutstandingBalance } from '../db/repositories/advances';
import { updateSettings } from '../db/repositories/settings';
import { previewSettlement, finalizeSettlement } from '../services/settlementService';
import { daysInPeriod } from '../utils/dates';

const PERIOD = '2026-02'; // 28 days, no weekly-off edge cases to keep math simple... actually has Sundays

async function clearAll() {
  await db.transaction(
    'rw',
    [db.employees, db.attendance, db.holidays, db.advanceTransactions, db.salaryPayments, db.salarySettlements, db.settings, db.appMetadata],
    async () => {
      await Promise.all([
        db.employees.clear(),
        db.attendance.clear(),
        db.holidays.clear(),
        db.advanceTransactions.clear(),
        db.salaryPayments.clear(),
        db.salarySettlements.clear(),
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
    weeklyOffDays: [0],
  });
});

async function markPresentForAllDays(employeeId: string, period: string, excludeDates: string[] = []) {
  for (const date of daysInPeriod(period)) {
    if (excludeDates.includes(date)) continue;
    await setAttendanceStatus(employeeId, date, 'PRESENT');
  }
}

describe('settlementService', () => {
  it('does not deduct salary for paid holidays', async () => {
    const employee = await createEmployee({
      employeeCode: 'E1',
      name: 'Asha',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 26_000_00,
    });
    await addHoliday({ date: '2026-02-16', name: 'Festival', paid: true });
    await markPresentForAllDays(employee.id, PERIOD, ['2026-02-16']);

    const preview = await previewSettlement(employee.id, PERIOD);
    expect(preview.snapshot.paidHolidayDays).toBeGreaterThanOrEqual(1);
    expect(preview.snapshot.attendanceDeductionPaise).toBe(0);
    expect(preview.snapshot.finalPayablePaise).toBe(26_000_00);
  });

  it('prevents finalizing the same employee/period twice and does not double-recover an advance', async () => {
    const employee = await createEmployee({
      employeeCode: 'E2',
      name: 'Rahul',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 26_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-05', type: 'ADVANCE', amountPaise: 5_000_00 });

    const first = await finalizeSettlement(employee.id, PERIOD);
    expect(first.settlement.advanceRecoveryPaise).toBe(5_000_00);

    await expect(finalizeSettlement(employee.id, PERIOD)).rejects.toThrow(/already finalized/i);

    const advances = await listAdvancesForEmployee(employee.id);
    const outstanding = computeOutstandingBalance(advances);
    expect(outstanding).toBe(0); // recovered exactly once, not twice
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

    const result = await finalizeSettlement(employee.id, PERIOD);
    expect(result.settlement.payablePaise).toBe(0);
    expect(result.settlement.carriedForwardPaise).toBe(5_000_00);
  });

  it('excludes days outside the employment window for a mid-month joiner', async () => {
    const employee = await createEmployee({
      employeeCode: 'E4',
      name: 'Mid Joiner',
      joiningDate: '2026-02-15',
      monthlySalaryPaise: 26_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);

    const preview = await previewSettlement(employee.id, PERIOD);
    const outsideCount = preview.days.filter((d) => d.source === 'OUTSIDE_EMPLOYMENT').length;
    expect(outsideCount).toBe(14); // Feb 1-14
  });
});
