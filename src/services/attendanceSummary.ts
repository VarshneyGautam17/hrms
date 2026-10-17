import type { AttendanceRecord, AttendanceStatus, Employee } from '../types';
import { daysInPeriod, weekdayOf, isWeeklyOffDay } from '../utils/dates';

export type DaySource = 'ATTENDANCE' | 'WEEKLY_OFF' | 'NOT_MARKED' | 'OUTSIDE_EMPLOYMENT';

export interface DayClassification {
  date: string;
  source: DaySource;
  status: AttendanceStatus | 'OUTSIDE_EMPLOYMENT';
  paid: boolean;
}

export interface AttendanceSummaryCounts {
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  paidWeeklyOffDays: number;
}

export interface AttendanceSummaryResult {
  days: DayClassification[];
  counts: AttendanceSummaryCounts;
}

function emptyCounts(): AttendanceSummaryCounts {
  return {
    presentDays: 0,
    halfDays: 0,
    unpaidAbsentDays: 0,
    paidWeeklyOffDays: 0,
  };
}

/**
 * Classifies every calendar day of a period for one employee, combining
 * explicit attendance marks with the fixed weekly off (every Monday).
 * Priority order: explicit attendance mark > weekly off > not marked
 * (treated as unpaid absent). Days before the employee's joining date are
 * excluded so a mid-month joiner is not penalized for days before they
 * started.
 */
export function summarizeAttendanceForEmployee(
  employee: Employee,
  period: string,
  attendanceRecords: AttendanceRecord[],
): AttendanceSummaryResult {
  const attendanceByDate = new Map(attendanceRecords.map((a) => [a.date, a]));

  const days: DayClassification[] = [];
  const counts = emptyCounts();

  for (const date of daysInPeriod(period)) {
    if (date < employee.joiningDate) {
      days.push({ date, source: 'OUTSIDE_EMPLOYMENT', status: 'OUTSIDE_EMPLOYMENT', paid: false });
      continue;
    }

    const attendance = attendanceByDate.get(date);
    if (attendance) {
      days.push({ date, source: 'ATTENDANCE', status: attendance.status, paid: attendance.status !== 'ABSENT' });
      applyCount(counts, attendance.status);
      continue;
    }

    if (isWeeklyOffDay(weekdayOf(date))) {
      days.push({ date, source: 'WEEKLY_OFF', status: 'WEEKLY_OFF', paid: true });
      counts.paidWeeklyOffDays += 1;
      continue;
    }

    days.push({ date, source: 'NOT_MARKED', status: 'ABSENT', paid: false });
    counts.unpaidAbsentDays += 1;
  }

  return { days, counts };
}

function applyCount(counts: AttendanceSummaryCounts, status: AttendanceStatus): void {
  switch (status) {
    case 'PRESENT':
      counts.presentDays += 1;
      break;
    case 'HALF_DAY':
      counts.halfDays += 1;
      break;
    case 'ABSENT':
    default:
      counts.unpaidAbsentDays += 1;
      break;
  }
}
