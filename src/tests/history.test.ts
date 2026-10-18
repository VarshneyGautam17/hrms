import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { buildHistory, filterAndSortHistory, groupByMonth, totalsOf, type HistoryData } from '../services/historyService';
import { buildHistoryPdf, historyFileName } from '../services/historyPdf';
import { calculateSalary } from '../services/salaryCalculator';
import type { Employee } from '../types';

function employee(id: string, name: string, code: string, joiningDate = '2026-01-01'): Employee {
  return { id, name, employeeCode: code, joiningDate, phone: null, department: null, monthlySalaryPaise: 30_000_00, createdAt: '', updatedAt: '' };
}

const asha = employee('e1', 'Asha', 'E002');
const ravi = employee('e2', 'Ravi', 'E001');
const late = employee('e3', 'Late Joiner', 'E003', '2026-09-10');

const septemberSnapshot = calculateSalary({
  monthlySalaryPaise: 30_000_00,
  divisor: 30,
  totalDaysInMonth: 30,
  presentDays: 24,
  halfDays: 1,
  unpaidAbsentDays: 1,
  notMarkedDays: 0,
  paidWeeklyOffDays: 4,
  weeklyOffWorkedDays: 1,
  otherDeductionPaise: 0,
  alreadyPaidPaise: 0,
  outstandingAdvanceBeforePaise: 0,
});

const data: HistoryData = {
  employees: [asha, ravi, late],
  weeklyOffDay: 1, // Monday
  attendance: [
    { id: 'a1', employeeId: 'e1', date: '2026-08-03', status: 'PRESENT', notes: null, updatedAt: '' }, // a Monday → worked on off
    { id: 'a2', employeeId: 'e1', date: '2026-08-04', status: 'PRESENT', notes: null, updatedAt: '' },
    { id: 'a3', employeeId: 'e1', date: '2026-08-05', status: 'ABSENT', notes: null, updatedAt: '' },
    { id: 'a4', employeeId: 'e2', date: '2026-08-04', status: 'HALF_DAY', notes: null, updatedAt: '' },
  ],
  advances: [
    { id: 'v1', employeeId: 'e1', date: '2026-08-10', type: 'ADVANCE', amountPaise: 5_000_00, notes: null, createdAt: '' },
    { id: 'v2', employeeId: 'e1', date: '2026-08-20', type: 'REPAYMENT', amountPaise: 1_000_00, notes: null, createdAt: '' },
    { id: 'v3', employeeId: 'e2', date: '2026-09-02', type: 'ADVANCE', amountPaise: 2_000_00, notes: null, createdAt: '' },
  ],
  payments: [
    { id: 'p1', employeeId: 'e1', date: '2026-09-01', amountPaise: 20_000_00, method: 'Salary', notes: null, period: '2026-08', createdAt: '' },
    { id: 'p2', employeeId: 'e1', date: '2026-08-15', amountPaise: 3_000_00, method: 'Cash', notes: null, period: '2026-08', createdAt: '' },
    { id: 'p3', employeeId: 'e2', date: '2026-10-01', amountPaise: 31_500_00, method: 'Salary', notes: null, period: '2026-09', createdAt: '' },
  ],
  finalizations: [
    { id: 'e2_2026-09', employeeId: 'e2', period: '2026-09', finalizedAt: '2026-10-01T05:00:00.000Z', advanceTransactionId: null, paymentId: 'p3', snapshot: septemberSnapshot },
  ],
};

const records = buildHistory(data, ['2026-09', '2026-08']);
const find = (id: string, period: string) => records.find((r) => r.employee.id === id && r.period === period)!;

describe('buildHistory', () => {
  it('makes one record per employee per month, skipping months before they joined', () => {
    expect(records.filter((r) => r.period === '2026-08').map((r) => r.employee.id).sort()).toEqual(['e1', 'e2']);
    expect(records.filter((r) => r.period === '2026-09').map((r) => r.employee.id).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it("totals each month's salary payments and advance entries for the employee", () => {
    const r = find('e1', '2026-08');
    expect(r.salaryPaidPaise).toBe(23_000_00);
    expect(r.payments.map((p) => p.id)).toEqual(['p2', 'p1']); // oldest first
    expect(r.advanceGivenPaise).toBe(5_000_00);
    expect(r.advanceReturnedPaise).toBe(1_000_00);
    expect(find('e1', '2026-09').salaryPaidPaise).toBe(0);
  });

  it('counts attendance live for open months, including work on the weekly off', () => {
    const a = find('e1', '2026-08').attendance;
    expect(a.present).toBe(1);
    expect(a.absent).toBe(1);
    expect(a.workedOnOff).toBe(1);
    expect(find('e2', '2026-08').attendance.halfDay).toBe(1);
  });

  it('lists every day of the month with its attendance, note and money movements', () => {
    const days = find('e1', '2026-08').days;
    expect(days).toHaveLength(31);
    const byDate = (date: string) => days.find((d) => d.date === date)!;
    expect(byDate('2026-08-03')).toMatchObject({ status: 'PRESENT', weeklyOff: true });
    expect(byDate('2026-08-05').status).toBe('ABSENT');
    expect(byDate('2026-08-10').events).toEqual([{ kind: 'ADVANCE_GIVEN', amountPaise: 5_000_00, notes: null }]);
    expect(byDate('2026-08-20').events[0].kind).toBe('ADVANCE_RETURNED');
    expect(byDate('2026-08-15').events[0]).toMatchObject({ kind: 'SALARY_PAID', method: 'Cash', forPeriod: '2026-08' });
    // August's salary paid on 1 September shows on that day of September, not in August.
    expect(days.some((d) => d.events.some((e) => e.amountPaise === 20_000_00))).toBe(false);
    expect(find('e1', '2026-09').days.find((d) => d.date === '2026-09-01')!.events[0]).toMatchObject({
      kind: 'SALARY_PAID',
      forPeriod: '2026-08',
    });
  });

  it('uses the frozen salary numbers for finalized months', () => {
    const r = find('e2', '2026-09');
    expect(r.finalization?.id).toBe('e2_2026-09');
    expect(r.attendance).toMatchObject({ present: 24, halfDay: 1, absent: 1, weeklyOff: 4, workedOnOff: 1, paidDays: 28.5 });
  });
});

describe('filterAndSortHistory', () => {
  const base = { search: '', employeeId: 'ALL', period: 'ALL', sort: 'name' as const };

  it('shows the newest month first, then sorts employees within each month', () => {
    const sorted = filterAndSortHistory(records, base);
    expect(sorted.map((r) => `${r.period}:${r.employee.name}`)).toEqual([
      '2026-09:Asha',
      '2026-09:Late Joiner',
      '2026-09:Ravi',
      '2026-08:Asha',
      '2026-08:Ravi',
    ]);
    const byCode = filterAndSortHistory(records, { ...base, period: '2026-09', sort: 'code' });
    expect(byCode.map((r) => r.employee.employeeCode)).toEqual(['E001', 'E002', 'E003']);
    const bySalary = filterAndSortHistory(records, { ...base, period: '2026-08', sort: 'salaryPaid' });
    expect(bySalary.map((r) => r.employee.name)).toEqual(['Asha', 'Ravi']);
  });

  it('filters by employee, month and search text (name or code)', () => {
    expect(filterAndSortHistory(records, { ...base, employeeId: 'e2' }).every((r) => r.employee.id === 'e2')).toBe(true);
    expect(filterAndSortHistory(records, { ...base, period: '2026-08' })).toHaveLength(2);
    expect(filterAndSortHistory(records, { ...base, search: 'late' }).map((r) => r.employee.id)).toEqual(['e3']);
    expect(filterAndSortHistory(records, { ...base, search: 'e001' }).map((r) => r.employee.id)).toEqual(['e2', 'e2']);
  });

  it('groups by month and totals the money', () => {
    const groups = groupByMonth(filterAndSortHistory(records, base));
    expect(groups.map((g) => g.period)).toEqual(['2026-09', '2026-08']);
    expect(totalsOf(records)).toEqual({ salaryPaidPaise: 54_500_00, advanceGivenPaise: 7_000_00, advanceReturnedPaise: 1_000_00 });
  });
});

describe('buildHistoryPdf', () => {
  it('draws every row inside the page margins, adding pages as needed', () => {
    // 3 employees x 40 months = enough rows to need several pages.
    const periods = Array.from({ length: 40 }, (_, i) => `20${23 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
    const many = buildHistory({ ...data, employees: [asha, ravi, { ...late, joiningDate: '2020-01-01' }] }, periods);

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const textSpy = vi.spyOn(doc, 'text');
    buildHistoryPdf(many, 'Employee: All Employees', new Date(2026, 9, 18), { includeDays: true }, doc);

    const height = doc.internal.pageSize.getHeight();
    const ys = textSpy.mock.calls.map((call) => call[2] as number);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(height - 20);
    expect(Math.min(...ys)).toBeGreaterThan(20);
    const texts = textSpy.mock.calls.map((call) => String(call[0]));
    expect(texts).toContain(`Page 1 of ${doc.getNumberOfPages()}`);
  });

  it('continues a long month onto the next page with its header repeated', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => employee(`c${i}`, `Worker ${i}`, `C${i}`));
    const month = buildHistory({ ...data, employees: crowd }, ['2026-08']);

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const textSpy = vi.spyOn(doc, 'text');
    buildHistoryPdf(month, 'Month: August 2026', new Date(2026, 9, 18), { includeDays: false }, doc);

    const texts = textSpy.mock.calls.map((call) => String(call[0]));
    expect(doc.getNumberOfPages()).toBe(2);
    expect(texts).toContain('August 2026 (continued)');
    expect(texts.filter((t) => t === 'Employee')).toHaveLength(2); // header row on both pages
    expect(Math.max(...textSpy.mock.calls.map((call) => call[2] as number))).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 20);
  });

  it('adds a day-by-day table listing attendance and money for every date', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const textSpy = vi.spyOn(doc, 'text');
    buildHistoryPdf([find('e1', '2026-08')], 'Employee: Asha', new Date(2026, 9, 18), { includeDays: true }, doc);
    const texts = textSpy.mock.calls.map((call) => String(call[0]));

    expect(texts).toContain('Day-by-Day Details');
    expect(texts).toContain('Asha (E002)  -  August 2026');
    for (const day of ['01 Aug 2026', '15 Aug 2026', '31 Aug 2026']) expect(texts).toContain(day);
    expect(texts).toContain('Worked on Weekly Off'); // Monday 3 Aug, marked Present
    expect(texts).toContain('5,000.00'); // advance given on 10 Aug
    expect(texts).toContain('3,000.00'); // salary paid in cash on 15 Aug
    expect(texts).toContain('Salary paid (for Aug 2026) - Cash');
    expect(Math.max(...textSpy.mock.calls.map((call) => call[2] as number))).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 20);
  });

  it("fits a whole 31-day month's day table on a single page", () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    buildHistoryPdf([find('e1', '2026-08')], 'Employee: Asha', new Date(2026, 9, 18), { includeDays: true }, doc);
    expect(doc.getNumberOfPages()).toBe(2); // page 1: monthly summary, page 2: all 31 days
  });

  it('leaves the day-by-day tables out when asked to', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const textSpy = vi.spyOn(doc, 'text');
    buildHistoryPdf([find('e1', '2026-08')], 'Employee: Asha', new Date(2026, 9, 18), { includeDays: false }, doc);
    expect(textSpy.mock.calls.map((call) => String(call[0]))).not.toContain('Day-by-Day Details');
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('names the file after the employee, month and download time', () => {
    const at = new Date(2026, 9, 18, 9, 5);
    expect(historyFileName('Ravi (E001)', '2026-09', at)).toBe('History_Ravi-E001_Sep-2026_2026-10-18_09-05.pdf');
    expect(historyFileName('All Employees', 'ALL', at)).toBe('History_All-Employees_All-Months_2026-10-18_09-05.pdf');
  });
});
