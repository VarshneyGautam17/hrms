import { describe, it, expect } from 'vitest';
import { summarizeAttendanceForEmployee } from '../services/attendanceSummary';
import { todayISO, currentPeriod, weekdayOf, daysInPeriod } from '../utils/dates';
import type { Employee, AttendanceRecord } from '../types';

const employee: Employee = {
  id: 'emp-1',
  employeeCode: 'E1',
  name: 'Test Employee',
  joiningDate: '2020-01-01',
  phone: null,
  department: null,
  monthlySalaryPaise: 26_000_00,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
};

describe('summarizeAttendanceForEmployee', () => {
  it('classifies days after today as FUTURE, excluded from every count', () => {
    const period = currentPeriod();
    const today = todayISO();

    const { days, counts } = summarizeAttendanceForEmployee(employee, period, [], 1);

    // Future Mondays are still the weekly off (that's known in advance); only non-Monday future days are "FUTURE".
    const futureDays = days.filter((d) => d.date > today && weekdayOf(d.date) !== 1);
    const pastOrTodayNonWeeklyOff = days.filter((d) => d.date <= today && weekdayOf(d.date) !== 1);

    // Every non-Monday day after today is FUTURE, and FUTURE days are never paid.
    expect(futureDays.every((d) => d.status === 'FUTURE' && d.source === 'FUTURE' && d.paid === false)).toBe(true);

    // Every day up to and including today (that isn't the weekly off) is unmarked -> NOT_MARKED, not FUTURE.
    expect(pastOrTodayNonWeeklyOff.every((d) => d.status === 'NOT_MARKED')).toBe(true);

    // Only past/today unmarked days count toward the deduction; future days contribute nothing.
    expect(counts.notMarkedDays).toBe(pastOrTodayNonWeeklyOff.length);
    expect(counts.presentDays + counts.halfDays + counts.unpaidAbsentDays).toBe(0);
  });

  it('still shows an explicit attendance mark even if it were somehow set on a future date', () => {
    const period = currentPeriod();
    const futureDate = daysInPeriod(period).find((d) => d > todayISO());
    if (!futureDate) return; // today is the last day of the month in this run; nothing to assert

    const records: AttendanceRecord[] = [
      { id: 'a1', employeeId: employee.id, date: futureDate, status: 'PRESENT', notes: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    ];

    const { days } = summarizeAttendanceForEmployee(employee, period, records, 1);
    const day = days.find((d) => d.date === futureDate);
    expect(day?.status).toBe('PRESENT');
    expect(day?.source).toBe('ATTENDANCE');
  });
});
