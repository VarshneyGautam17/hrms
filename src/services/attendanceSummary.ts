import type { AttendanceRecord, AttendanceStatus, Employee } from '../types';
import { daysInPeriod, weekdayOf, isWeeklyOffDay, todayISO } from '../utils/dates';

export type DaySource = 'ATTENDANCE' | 'WEEKLY_OFF' | 'NOT_MARKED' | 'OUTSIDE_EMPLOYMENT' | 'FUTURE';

export interface DayClassification {
  date: string;
  source: DaySource;
  status: AttendanceStatus | 'OUTSIDE_EMPLOYMENT' | 'NOT_MARKED' | 'FUTURE';
  paid: boolean;
  /** True when this day counted as a paid weekly off (whether or not the employee also came in to work). */
  weeklyOff: boolean;
}

export interface AttendanceSummaryCounts {
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  /** Days nobody marked at all — kept separate from unpaidAbsentDays so it can be labeled "Not Marked" instead of "Absent". */
  notMarkedDays: number;
  paidWeeklyOffDays: number;
  /** Weekly off days the employee still worked: 1 for Present, 0.5 for Half Day. Earns extra pay on top of the paid weekly off. */
  weeklyOffWorkedDays: number;
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
    weeklyOffWorkedDays: 0,
  };
}

/**
 * Classifies every calendar day of a period for one employee, combining
 * explicit attendance marks with the company's configured weekly off day.
 * Priority order: explicit attendance mark > future > weekly off > not
 * marked. A mark on a weekly off never makes that day unpaid: Present or
 * Half Day there counts as weekly-off work (extra pay on top), and Absent
 * leaves it a plain paid weekly off. A day nobody marked is never labeled "Absent" — it gets its own
 * "Not Marked" status — but it is still unpaid in the salary math, same as
 * an explicit absence, until someone marks it Present or Half Day. Days
 * after today (weekly offs included) are "Future": they haven't been earned
 * yet, so they never count toward pay. Days before the employee's joining
 * date are "Outside Employment" and likewise earn nothing.
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
      days.push({ date, source: 'OUTSIDE_EMPLOYMENT', status: 'OUTSIDE_EMPLOYMENT', paid: false, weeklyOff: false });
      continue;
    }

    const weeklyOff = isWeeklyOffDay(weekdayOf(date), weeklyOffDay);
    const attendance = attendanceByDate.get(date);
    if (attendance && weeklyOff) {
      // The weekly off stays paid no matter what was marked. Coming in to work
      // on it earns extra on top; an "Absent" mark on a day off costs nothing.
      days.push({ date, source: 'ATTENDANCE', status: attendance.status, paid: true, weeklyOff: true });
      counts.paidWeeklyOffDays += 1;
      if (attendance.status === 'PRESENT') counts.weeklyOffWorkedDays += 1;
      else if (attendance.status === 'HALF_DAY') counts.weeklyOffWorkedDays += 0.5;
      continue;
    }

    if (attendance) {
      days.push({ date, source: 'ATTENDANCE', status: attendance.status, paid: attendance.status !== 'ABSENT', weeklyOff: false });
      applyCount(counts, attendance.status);
      continue;
    }

    if (date > today) {
      days.push({ date, source: 'FUTURE', status: 'FUTURE', paid: false, weeklyOff: false });
      continue;
    }

    if (weeklyOff) {
      days.push({ date, source: 'WEEKLY_OFF', status: 'WEEKLY_OFF', paid: true, weeklyOff: true });
      counts.paidWeeklyOffDays += 1;
      continue;
    }

    days.push({ date, source: 'NOT_MARKED', status: 'NOT_MARKED', paid: false, weeklyOff: false });
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
