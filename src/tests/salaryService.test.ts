import { describe, it, expect, beforeEach } from 'vitest';
import { __resetFakeFirestore } from './mocks/fakeFirestore';
import { createEmployee } from '../db/repositories/employees';
import { clearAttendance, setAttendanceStatus } from '../db/repositories/attendance';
import { addAdvanceTransaction } from '../db/repositories/advances';
import { updateSettings } from '../db/repositories/settings';
import { computeSalarySlip } from '../services/salaryService';
import { daysInPeriod, weekdayOf } from '../utils/dates';

const PERIOD = '2026-02'; // 28 days

beforeEach(async () => {
  __resetFakeFirestore();
  await updateSettings({ weeklyOffDay: 1 });
});

/** Marks every working day Present. Mondays (the weekly off) are left alone — working them would earn extra pay. */
async function markPresentForAllDays(employeeId: string, period: string, excludeDates: string[] = []) {
  for (const date of daysInPeriod(period)) {
    if (excludeDates.includes(date) || weekdayOf(date) === 1) continue;
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

  it('labels an unmarked day as "Not Marked" rather than "Absent", while still deducting it the same way', async () => {
    const employee = await createEmployee({
      employeeCode: 'E6',
      name: 'Unmarked Person',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 26_000_00,
    });
    // Leave every day unmarked — no attendance records at all.

    const slip = await computeSalarySlip(employee.id, PERIOD);
    const workingDays = daysInPeriod(PERIOD).filter((d) => weekdayOf(d) !== 1).length; // excludes Mondays (weekly off)

    expect(slip.snapshot.unpaidAbsentDays).toBe(0);
    expect(slip.snapshot.notMarkedDays).toBe(workingDays);
    expect(slip.days.filter((d) => d.status === 'NOT_MARKED')).toHaveLength(workingDays);
    expect(slip.days.some((d) => d.status === 'ABSENT')).toBe(false);
    // Still unpaid for those days, same deduction as if explicitly marked absent.
    expect(slip.snapshot.attendanceDeductionPaise).toBe(Math.round(slip.snapshot.dailyRatePaise * workingDays));
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
    // Paid only for the 14 days worked (Feb 15-28), not the full month.
    expect(slip.snapshot.earnedSalaryPaise).toBe(13_000_00);
  });

  it('pays extra for coming to work on the weekly off, on top of the paid day off', async () => {
    const employee = await createEmployee({
      employeeCode: 'E7',
      name: 'Off Day Worker',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 28_000_00, // ₹1,000 per day in a 28-day February
    });
    await markPresentForAllDays(employee.id, PERIOD);
    const [firstMonday, secondMonday] = daysInPeriod(PERIOD).filter((d) => weekdayOf(d) === 1);
    await setAttendanceStatus(employee.id, firstMonday, 'PRESENT');
    await setAttendanceStatus(employee.id, secondMonday, 'HALF_DAY');

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.paidWeeklyOffDays).toBe(4);
    expect(slip.snapshot.weeklyOffWorkedDays).toBe(1.5);
    expect(slip.snapshot.weeklyOffExtraPaise).toBe(1_500_00);
    expect(slip.snapshot.earnedSalaryPaise).toBe(28_000_00 + 1_500_00);
  });

  it('does not cut pay when a weekly off is marked Absent', async () => {
    const employee = await createEmployee({
      employeeCode: 'E8',
      name: 'Absent On Off',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 28_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);
    const firstMonday = daysInPeriod(PERIOD).find((d) => weekdayOf(d) === 1)!;
    await setAttendanceStatus(employee.id, firstMonday, 'ABSENT');

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.unpaidAbsentDays).toBe(0);
    expect(slip.snapshot.earnedSalaryPaise).toBe(28_000_00);
  });

  it('treats a cleared mark as Not Marked again', async () => {
    const employee = await createEmployee({
      employeeCode: 'E9',
      name: 'Cleared Mark',
      joiningDate: '2026-01-01',
      monthlySalaryPaise: 28_000_00,
    });
    await markPresentForAllDays(employee.id, PERIOD);
    await clearAttendance(employee.id, '2026-02-10');

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.notMarkedDays).toBe(1);
    expect(slip.days.find((d) => d.date === '2026-02-10')?.status).toBe('NOT_MARKED');
    expect(slip.snapshot.earnedSalaryPaise).toBe(27_000_00);
  });
});
