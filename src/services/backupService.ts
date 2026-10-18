import { getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { userCollection, userDoc } from '../firebase/paths';
import { firestore } from '../firebase/config';
import { createDefaultSettings } from '../db/repositories/settings';
import { paidDaysOf } from './salaryCalculator';
import { paiseToRupees } from '../utils/currency';
import { formatDisplayPeriod } from '../utils/dates';
import type { Employee, AttendanceRecord, AdvanceTransaction, SalaryPayment, SalaryFinalization } from '../types';

const COLLECTIONS = ['employees', 'attendance', 'advanceTransactions', 'salaryPayments', 'salaryFinalizations'] as const;

async function fetchAll<T>(name: string): Promise<T[]> {
  const snap = await getDocs(userCollection(name));
  return snap.docs.map((d) => d.data() as T);
}

/**
 * A value that Excel must show exactly as written. Dates and month names
 * are wrapped as ="..." because Excel otherwise converts them to real dates
 * and shows "####" whenever the column is narrower than its date format.
 */
class AsText {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}

type Cell = string | number | AsText | null | undefined;

function csvEscape(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (value instanceof AsText) return `"=""${value.text.replace(/"/g, '""""')}"""`;
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvSection(title: string, columns: string[], rows: Cell[][]): string {
  return [title, columns.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

const date = (iso: string | null | undefined) => (iso ? new AsText(format(parseISO(iso), 'dd MMM yyyy')) : '');
const dateTime = (iso: string | null | undefined) => (iso ? new AsText(format(parseISO(iso), 'dd MMM yyyy, hh:mm a')) : '');
const month = (period: string | null | undefined) => (period ? new AsText(formatDisplayPeriod(period)) : '');
/** Plain rupee number (e.g. 10000.5) so Excel can still add the column up. */
const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? '' : Math.round(paiseToRupees(paise) * 100) / 100;

const STATUS_LABELS: Record<string, string> = { PRESENT: 'Present', HALF_DAY: 'Half Day', ABSENT: 'Absent' };
const ADVANCE_TYPE_LABELS: Record<string, string> = { ADVANCE: 'Advance Given', REPAYMENT: 'Advance Returned' };

export interface ExportData {
  employees: Employee[];
  attendance: AttendanceRecord[];
  advanceTransactions: AdvanceTransaction[];
  salaryPayments: SalaryPayment[];
  salaryFinalizations: SalaryFinalization[];
}

/**
 * Builds the export as one CSV with a section per kind of record. It is meant
 * to be read by people in Excel: employees appear by name and code (never by
 * internal id), amounts are in rupees, and dates are readable text.
 */
export function buildExportCsv(data: ExportData): string {
  const employeeById = new Map(data.employees.map((e) => [e.id, e]));
  const nameOf = (id: string) => employeeById.get(id)?.name ?? '(deleted employee)';
  // Codes like "007" must stay as written; Excel would otherwise drop the leading zeros.
  const codeOf = (id: string) => new AsText(employeeById.get(id)?.employeeCode ?? '');
  const byDateThenName = <T extends { date: string; employeeId: string }>(a: T, b: T) =>
    a.date.localeCompare(b.date) || nameOf(a.employeeId).localeCompare(nameOf(b.employeeId));

  const employees = [...data.employees].sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

  const sections = [
    toCsvSection(
      'EMPLOYEES',
      ['Employee Code', 'Name', 'Department', 'Phone', 'Joining Date', 'Monthly Salary (Rs)'],
      employees.map((e) => [
        new AsText(e.employeeCode),
        e.name,
        e.department,
        e.phone ? new AsText(e.phone) : '',
        date(e.joiningDate),
        rupees(e.monthlySalaryPaise),
      ]),
    ),
    toCsvSection(
      'ATTENDANCE',
      ['Date', 'Employee', 'Employee Code', 'Status', 'Notes'],
      [...data.attendance]
        .sort(byDateThenName)
        .map((a) => [date(a.date), nameOf(a.employeeId), codeOf(a.employeeId), STATUS_LABELS[a.status] ?? a.status, a.notes]),
    ),
    toCsvSection(
      'ADVANCES',
      ['Date', 'Employee', 'Employee Code', 'Type', 'Amount (Rs)', 'Notes'],
      [...data.advanceTransactions]
        .sort(byDateThenName)
        .map((t) => [
          date(t.date),
          nameOf(t.employeeId),
          codeOf(t.employeeId),
          ADVANCE_TYPE_LABELS[t.type] ?? t.type,
          rupees(t.amountPaise),
          t.notes,
        ]),
    ),
    toCsvSection(
      'SALARY PAYMENTS',
      ['Date', 'Employee', 'Employee Code', 'Salary Month', 'Amount (Rs)', 'Method', 'Notes'],
      [...data.salaryPayments]
        .sort(byDateThenName)
        .map((p) => [
          date(p.date),
          nameOf(p.employeeId),
          codeOf(p.employeeId),
          month(p.period),
          rupees(p.amountPaise),
          p.method,
          p.notes,
        ]),
    ),
    toCsvSection(
      'FINALIZED SALARIES',
      [
        'Salary Month',
        'Employee',
        'Employee Code',
        'Finalized On',
        'Monthly Salary (Rs)',
        'Days in Month',
        'Per Day Rate (Rs)',
        'Present',
        'Half Day',
        'Absent',
        'Not Marked',
        'Weekly Off',
        'Worked on Weekly Off',
        'Paid Days',
        'Unpaid Days',
        'Extra for Weekly Off Work (Rs)',
        'Earned Salary (Rs)',
        'Other Deduction (Rs)',
        'Already Paid (Rs)',
        'Advance Pending Before (Rs)',
        'Advance Cut from Salary (Rs)',
        'Advance Still Pending (Rs)',
        'Final Payable (Rs)',
      ],
      [...data.salaryFinalizations]
        .sort((a, b) => a.period.localeCompare(b.period) || nameOf(a.employeeId).localeCompare(nameOf(b.employeeId)))
        .map((f) => {
          const s = f.snapshot;
          return [
            month(f.period),
            nameOf(f.employeeId),
            codeOf(f.employeeId),
            dateTime(f.finalizedAt),
            rupees(s.monthlySalaryPaise),
            s.totalDaysInMonth,
            rupees(s.dailyRatePaise),
            s.presentDays,
            s.halfDays,
            s.unpaidAbsentDays,
            s.notMarkedDays,
            s.paidWeeklyOffDays,
            s.weeklyOffWorkedDays ?? 0,
            paidDaysOf(s),
            s.unpaidDayEquivalents,
            rupees(s.weeklyOffExtraPaise ?? 0),
            rupees(s.earnedSalaryPaise),
            rupees(s.otherDeductionPaise),
            rupees(s.alreadyPaidPaise),
            rupees(s.outstandingAdvanceBeforePaise),
            rupees(s.advanceRecoveredPaise),
            rupees(s.advanceCarriedForwardPaise),
            rupees(s.finalPayablePaise),
          ];
        }),
    ),
  ];

  // The byte-order mark makes Excel read the file as UTF-8, so names in
  // Hindi or other scripts don't turn into garbage.
  return '﻿' + sections.join('\n\n');
}

function downloadCsv(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hrms-export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetches every employee, attendance, advance, payment and finalization
 * record and downloads them as a single CSV file (one section per entity).
 * Returns the record counts for a summary toast.
 */
export async function exportAllDataAsCsv(): Promise<Record<string, number>> {
  const [employees, attendance, advanceTransactions, salaryPayments, salaryFinalizations] = await Promise.all([
    fetchAll<Employee>('employees'),
    fetchAll<AttendanceRecord>('attendance'),
    fetchAll<AdvanceTransaction>('advanceTransactions'),
    fetchAll<SalaryPayment>('salaryPayments'),
    fetchAll<SalaryFinalization>('salaryFinalizations'),
  ]);

  downloadCsv(buildExportCsv({ employees, attendance, advanceTransactions, salaryPayments, salaryFinalizations }));

  return {
    employees: employees.length,
    attendance: attendance.length,
    advanceTransactions: advanceTransactions.length,
    salaryPayments: salaryPayments.length,
    salaryFinalizations: salaryFinalizations.length,
  };
}

async function deleteAllInCollection(name: string): Promise<void> {
  const snap = await getDocs(userCollection(name));
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const id of ids.slice(i, i + 450)) {
      batch.delete(userDoc(name, id));
    }
    await batch.commit();
  }
}

/**
 * Permanently wipes every employee, attendance, advance, payment and
 * settings record for the signed-in user, then re-seeds the default
 * settings doc. There is no undo — export a CSV first if the data might
 * still be needed.
 */
export async function resetAllData(): Promise<void> {
  for (const name of COLLECTIONS) {
    await deleteAllInCollection(name);
  }
  await setDoc(userDoc('settings', 'default'), createDefaultSettings());
}
