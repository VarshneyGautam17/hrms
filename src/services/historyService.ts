import { summarizeAttendanceForEmployee, type AttendanceSummaryCounts, type DayClassification } from './attendanceSummary';
import { paidDaysOf } from './salaryCalculator';
import { daysInPeriod } from '../utils/dates';
import type { AdvanceTransaction, AttendanceRecord, Employee, SalaryFinalization, SalaryPayment } from '../types';

export interface HistoryAttendance {
  present: number;
  halfDay: number;
  absent: number;
  notMarked: number;
  weeklyOff: number;
  workedOnOff: number;
  paidDays: number;
}

/** A money movement on one day. */
export interface HistoryEvent {
  kind: 'ADVANCE_GIVEN' | 'ADVANCE_RETURNED' | 'SALARY_PAID';
  amountPaise: number;
  /** For salary payments: the salary month the payment was for (yyyy-MM). */
  forPeriod?: string;
  method?: string;
  notes: string | null;
}

/** One calendar day of one employee's month. */
export interface HistoryDay {
  date: string;
  /** Attendance as currently marked (or derived: weekly off, not marked, future, before joining). */
  status: DayClassification['status'];
  /** True when the day counted as a paid weekly off. */
  weeklyOff: boolean;
  /** The note written on that day's attendance mark, if any. */
  note: string | null;
  events: HistoryEvent[];
}

/** Everything about one employee in one month. */
export interface HistoryRecord {
  period: string;
  employee: Employee;
  attendance: HistoryAttendance;
  /** Every day of the month, in order. */
  days: HistoryDay[];
  advanceGivenPaise: number;
  advanceReturnedPaise: number;
  /** Total salary actually paid for this month (sum of the month's salary payments). */
  salaryPaidPaise: number;
  payments: SalaryPayment[];
  advances: AdvanceTransaction[];
  /** Present once the month's salary was finalized; holds the frozen salary breakdown. */
  finalization: SalaryFinalization | null;
}

export interface HistoryData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  advances: AdvanceTransaction[];
  payments: SalaryPayment[];
  finalizations: SalaryFinalization[];
  weeklyOffDay: number;
}

/**
 * Builds one record per employee per month, for every month in `periods`
 * the employee had joined by. Finalized months use the frozen salary
 * snapshot's attendance counts — the numbers the salary was actually paid
 * on — while other months are counted from current attendance.
 */
export function buildHistory(data: HistoryData, periods: string[]): HistoryRecord[] {
  const records: HistoryRecord[] = [];
  const finalizationByKey = new Map(data.finalizations.map((f) => [`${f.employeeId}_${f.period}`, f]));

  for (const period of periods) {
    const days = daysInPeriod(period);
    const lastDay = days[days.length - 1];

    for (const employee of data.employees) {
      if (employee.joiningDate > lastDay) continue;

      const finalization = finalizationByKey.get(`${employee.id}_${period}`) ?? null;
      const payments = data.payments
        .filter((p) => p.employeeId === employee.id && p.period === period)
        .sort((a, b) => a.date.localeCompare(b.date));
      const advances = data.advances
        .filter((t) => t.employeeId === employee.id && t.date.startsWith(period))
        .sort((a, b) => a.date.localeCompare(b.date));

      const attendanceRecords = data.attendance.filter((a) => a.employeeId === employee.id && a.date.startsWith(period));
      const summary = summarizeAttendanceForEmployee(employee, period, attendanceRecords, data.weeklyOffDay);

      records.push({
        period,
        employee,
        attendance: finalization ? attendanceFromSnapshot(finalization) : attendanceFromCounts(summary.counts),
        days: buildDays(summary.days, attendanceRecords, advances, paymentsDatedIn(data.payments, employee.id, period)),
        advanceGivenPaise: sumOf(advances.filter((t) => t.type === 'ADVANCE')),
        advanceReturnedPaise: sumOf(advances.filter((t) => t.type === 'REPAYMENT')),
        salaryPaidPaise: sumOf(payments),
        payments,
        advances,
        finalization,
      });
    }
  }
  return records;
}

function sumOf(items: { amountPaise: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountPaise, 0);
}

function attendanceFromSnapshot(f: SalaryFinalization): HistoryAttendance {
  const s = f.snapshot;
  return {
    present: s.presentDays,
    halfDay: s.halfDays,
    absent: s.unpaidAbsentDays,
    notMarked: s.notMarkedDays,
    weeklyOff: s.paidWeeklyOffDays,
    workedOnOff: s.weeklyOffWorkedDays ?? 0,
    paidDays: paidDaysOf(s),
  };
}

/**
 * Salary payments made on a date inside this month, whatever month they
 * were for — e.g. July's salary paid on 2 August shows on 2 August.
 */
function paymentsDatedIn(payments: SalaryPayment[], employeeId: string, period: string): SalaryPayment[] {
  return payments.filter((p) => p.employeeId === employeeId && p.date.startsWith(period));
}

function buildDays(
  classified: DayClassification[],
  attendance: AttendanceRecord[],
  advances: AdvanceTransaction[],
  payments: SalaryPayment[],
): HistoryDay[] {
  const noteByDate = new Map(attendance.map((a) => [a.date, a.notes]));
  return classified.map((d) => {
    const events: HistoryEvent[] = [
      ...advances
        .filter((t) => t.date === d.date)
        .map(
          (t): HistoryEvent => ({
            kind: t.type === 'ADVANCE' ? 'ADVANCE_GIVEN' : 'ADVANCE_RETURNED',
            amountPaise: t.amountPaise,
            notes: t.notes,
          }),
        ),
      ...payments
        .filter((p) => p.date === d.date)
        .map(
          (p): HistoryEvent => ({
            kind: 'SALARY_PAID',
            amountPaise: p.amountPaise,
            forPeriod: p.period,
            method: p.method,
            notes: p.notes,
          }),
        ),
    ];
    return { date: d.date, status: d.status, weeklyOff: d.weeklyOff, note: noteByDate.get(d.date) ?? null, events };
  });
}

/** Plain-words label for a day's attendance, e.g. "Worked on Weekly Off". */
export function dayStatusLabel(day: Pick<HistoryDay, 'status' | 'weeklyOff'>): string {
  if (day.weeklyOff) {
    if (day.status === 'PRESENT') return 'Worked on Weekly Off';
    if (day.status === 'HALF_DAY') return 'Half Day on Weekly Off';
    return 'Weekly Off';
  }
  const labels: Record<string, string> = {
    PRESENT: 'Present',
    HALF_DAY: 'Half Day',
    ABSENT: 'Absent',
    NOT_MARKED: 'Not Marked',
    WEEKLY_OFF: 'Weekly Off',
    FUTURE: 'Upcoming',
    OUTSIDE_EMPLOYMENT: 'Before Joining',
  };
  return labels[day.status] ?? day.status;
}

/** Plain-words label for a money event, e.g. "Salary paid (for Jul 2026)". */
export function eventLabel(event: HistoryEvent): string {
  if (event.kind === 'ADVANCE_GIVEN') return 'Advance given';
  if (event.kind === 'ADVANCE_RETURNED') return 'Advance returned';
  return `Salary paid${event.forPeriod ? ` (for ${formatShortPeriod(event.forPeriod)})` : ''}`;
}

function formatShortPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${year}`;
}

function attendanceFromCounts(counts: AttendanceSummaryCounts): HistoryAttendance {
  return {
    present: counts.presentDays,
    halfDay: counts.halfDays,
    absent: counts.unpaidAbsentDays,
    notMarked: counts.notMarkedDays,
    weeklyOff: counts.paidWeeklyOffDays,
    workedOnOff: counts.weeklyOffWorkedDays,
    paidDays: counts.presentDays + 0.5 * counts.halfDays + counts.paidWeeklyOffDays,
  };
}

export type HistorySort = 'name' | 'code' | 'salaryPaid' | 'paidDays' | 'absent' | 'advanceGiven';

export const HISTORY_SORT_LABELS: Record<HistorySort, string> = {
  name: 'Employee name (A–Z)',
  code: 'Employee code',
  salaryPaid: 'Salary paid (highest first)',
  paidDays: 'Paid days (most first)',
  absent: 'Absent days (most first)',
  advanceGiven: 'Advance given (highest first)',
};

export interface HistoryFilters {
  search: string;
  /** 'ALL' or an employee id. */
  employeeId: string;
  /** 'ALL' or a yyyy-MM month. */
  period: string;
  sort: HistorySort;
}

/** Applies the page's filters, then sorts: newest month first, and within each month by the chosen sort. */
export function filterAndSortHistory(records: HistoryRecord[], filters: HistoryFilters): HistoryRecord[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = records.filter(
    (r) =>
      (filters.employeeId === 'ALL' || r.employee.id === filters.employeeId) &&
      (filters.period === 'ALL' || r.period === filters.period) &&
      (!q || r.employee.name.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q)),
  );

  const byName = (a: HistoryRecord, b: HistoryRecord) => a.employee.name.localeCompare(b.employee.name);
  const within: Record<HistorySort, (a: HistoryRecord, b: HistoryRecord) => number> = {
    name: byName,
    code: (a, b) => a.employee.employeeCode.localeCompare(b.employee.employeeCode, undefined, { numeric: true }),
    salaryPaid: (a, b) => b.salaryPaidPaise - a.salaryPaidPaise || byName(a, b),
    paidDays: (a, b) => b.attendance.paidDays - a.attendance.paidDays || byName(a, b),
    absent: (a, b) => b.attendance.absent - a.attendance.absent || byName(a, b),
    advanceGiven: (a, b) => b.advanceGivenPaise - a.advanceGivenPaise || byName(a, b),
  };

  return filtered.sort((a, b) => b.period.localeCompare(a.period) || within[filters.sort](a, b));
}

/** Groups already-sorted records by month, keeping their order. */
export function groupByMonth(records: HistoryRecord[]): { period: string; records: HistoryRecord[] }[] {
  const groups: { period: string; records: HistoryRecord[] }[] = [];
  for (const record of records) {
    const last = groups[groups.length - 1];
    if (last && last.period === record.period) last.records.push(record);
    else groups.push({ period: record.period, records: [record] });
  }
  return groups;
}

export interface HistoryTotals {
  salaryPaidPaise: number;
  advanceGivenPaise: number;
  advanceReturnedPaise: number;
}

export function totalsOf(records: HistoryRecord[]): HistoryTotals {
  return records.reduce(
    (t, r) => ({
      salaryPaidPaise: t.salaryPaidPaise + r.salaryPaidPaise,
      advanceGivenPaise: t.advanceGivenPaise + r.advanceGivenPaise,
      advanceReturnedPaise: t.advanceReturnedPaise + r.advanceReturnedPaise,
    }),
    { salaryPaidPaise: 0, advanceGivenPaise: 0, advanceReturnedPaise: 0 },
  );
}
