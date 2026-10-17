import type { AttendanceRecord, AttendanceStatus, Employee, Holiday, AppSettings } from '../types';
import { daysInPeriod, weekdayOf } from '../utils/dates';

export type DaySource = 'ATTENDANCE' | 'HOLIDAY' | 'WEEKLY_OFF' | 'NOT_MARKED' | 'OUTSIDE_EMPLOYMENT';

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
  paidHolidayDays: number;
  unpaidHolidayDays: number;
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
    paidHolidayDays: 0,
    unpaidHolidayDays: 0,
    paidWeeklyOffDays: 0,
  };
}

/**
 * Classifies every calendar day of a period for one employee, combining
 * explicit attendance marks with holidays and weekly offs. Priority order:
 * explicit attendance mark > holiday > weekly off > not marked (treated as
 * unpaid absent). Employment window (joining/exit date) is respected so
 * mid-month joiners/leavers are not penalized for days outside their
 * employment.
 */
export function summarizeAttendanceForEmployee(
  employee: Employee,
  period: string,
  attendanceRecords: AttendanceRecord[],
  holidays: Holiday[],
  settings: Pick<AppSettings, 'weeklyOffDays'>,
): AttendanceSummaryResult {
  const attendanceByDate = new Map(attendanceRecords.map((a) => [a.date, a]));
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));

  const days: DayClassification[] = [];
  const counts = emptyCounts();

  for (const date of daysInPeriod(period)) {
    if (date < employee.joiningDate || (employee.exitDate && date > employee.exitDate)) {
      days.push({ date, source: 'OUTSIDE_EMPLOYMENT', status: 'OUTSIDE_EMPLOYMENT', paid: false });
      continue;
    }

    const attendance = attendanceByDate.get(date);
    if (attendance) {
      days.push({ date, source: 'ATTENDANCE', status: attendance.status, paid: attendance.status !== 'ABSENT' });
      applyCount(counts, attendance.status);
      continue;
    }

    const holiday = holidayByDate.get(date);
    if (holiday) {
      days.push({ date, source: 'HOLIDAY', status: 'HOLIDAY', paid: holiday.paid });
      if (holiday.paid) counts.paidHolidayDays += 1;
      else counts.unpaidHolidayDays += 1;
      continue;
    }

    if (settings.weeklyOffDays.includes(weekdayOf(date))) {
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
