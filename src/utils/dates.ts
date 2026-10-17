import {
  format,
  parseISO,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  isWithinInterval,
} from 'date-fns';

export const DATE_FMT = 'yyyy-MM-dd';
export const PERIOD_FMT = 'yyyy-MM';

/** Weekday labels, index 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function isWeeklyOffDay(weekday: number, weeklyOffDay: number): boolean {
  return weekday === weeklyOffDay;
}

export function todayISO(): string {
  return format(new Date(), DATE_FMT);
}

export function currentPeriod(): string {
  return format(new Date(), PERIOD_FMT);
}

export function periodToDate(period: string): Date {
  return parseISO(`${period}-01`);
}

export function previousPeriods(n: number, from: string = currentPeriod()): string[] {
  const base = periodToDate(from);
  const periods: string[] = [];
  for (let i = 0; i < n; i++) {
    periods.push(format(subMonths(base, i), PERIOD_FMT));
  }
  return periods;
}

export function daysInPeriod(period: string): string[] {
  const base = periodToDate(period);
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  return eachDayOfInterval({ start, end }).map((d) => format(d, DATE_FMT));
}

export function totalDaysInPeriod(period: string): number {
  return getDaysInMonth(periodToDate(period));
}

export function dateToPeriod(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function weekdayOf(dateISO: string): number {
  return parseISO(dateISO).getDay();
}

export function isDateInRange(dateISO: string, startISO: string, endISO: string): boolean {
  const date = parseISO(dateISO);
  return isWithinInterval(date, { start: parseISO(startISO), end: parseISO(endISO) });
}

export function formatDisplayDate(dateISO: string): string {
  return format(parseISO(dateISO), 'dd MMM yyyy');
}

export function formatDisplayPeriod(period: string): string {
  return format(periodToDate(period), 'MMMM yyyy');
}
