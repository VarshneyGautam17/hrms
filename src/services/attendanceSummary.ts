import type { AttendanceRecord, AttendanceStatus, Employee } from '../types';
import { daysInPeriod, weekdayOf, isWeeklyOffDay, todayISO } from '../utils/dates';

export type DaySource = 'ATTENDANCE' | 'WEEKLY_OFF' | 'NOT_MARKED' | 'OUTSIDE_EMPLOYMENT' | 'FUTURE';

export interface DayClassification {
  date: string;
  source: DaySource;
  status: AttendanceStatus | 'OUTSIDE_EMPLOYMENT' | 'NOT_MARKED' | 'FUTURE';
  paid: boolean;
}

export interface AttendanceSummaryCounts {
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  /** Days nobody marked at all — kept separate from unpaidAbsentDays so it can be labeled "Not Marked" instead of "Absent". */
  notMarkedDays: number;
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
    notMarkedDays: 0,
    paidWeeklyOffDays: 0,
  };
}

/**
 * Classifies every calendar day of a period for one employee, combining
 * explicit attendance marks with the company's configured weekly off day.
 * Priority order: explicit attendance mark > weekly off > future > not
 * marked. A day nobody marked is never labeled "Absent" — it gets its own
 * "Not Marked" status — but it is still unpaid in the salary math, same as
 * an explicit absence, until someone marks it Present or Half Day. Days
 * after today are "Future": never counted toward pay and never defaulted to
 * Absent/Not Marked, since they haven't happened yet. Days before the
 * employee's joining date are excluded so a mid-month joiner is not
 * penalized for days before they started.
 */
export function summarizeAttendanceForEmployee(
  employee: Employee,
  period: string,
  attendanceRecords: AttendanceRecord[],
  weeklyOffDay: number,
): AttendanceSummaryResult {
  const attendanceByDate = new Map(attendanceRecords.map((a) => [a.date, a]));
  const today = todayISO();

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

    if (isWeeklyOffDay(weekdayOf(date), weeklyOffDay)) {
      days.push({ date, source: 'WEEKLY_OFF', status: 'WEEKLY_OFF', paid: true });
      counts.paidWeeklyOffDays += 1;
      continue;
    }

    if (date > today) {
      days.push({ date, source: 'FUTURE', status: 'FUTURE', paid: false });
      continue;
    }

    days.push({ date, source: 'NOT_MARKED', status: 'NOT_MARKED', paid: false });
    counts.notMarkedDays += 1;
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
