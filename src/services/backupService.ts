import { getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { userCollection, userDoc } from '../firebase/paths';
import { firestore } from '../firebase/config';
import { createDefaultSettings } from '../db/repositories/settings';
import type { Employee, AttendanceRecord, AdvanceTransaction, SalaryPayment, SalaryFinalization } from '../types';

const COLLECTIONS = ['employees', 'attendance', 'advanceTransactions', 'salaryPayments', 'salaryFinalizations'] as const;

async function fetchAll<T>(name: string): Promise<T[]> {
  const snap = await getDocs(userCollection(name));
  return snap.docs.map((d) => d.data() as T);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvSection(title: string, columns: string[], rows: object[]): string {
  const lines = [
    title,
    columns.join(','),
    ...rows.map((row) => columns.map((c) => csvEscape((row as Record<string, unknown>)[c])).join(',')),
  ];
  return lines.join('\n');
}

function flattenFinalization(f: SalaryFinalization): Record<string, unknown> {
  const flat: Record<string, unknown> = {
    id: f.id,
    employeeId: f.employeeId,
    period: f.period,
    finalizedAt: f.finalizedAt,
    advanceTransactionId: f.advanceTransactionId,
    paymentId: f.paymentId,
  };
  for (const [k, v] of Object.entries(f.snapshot)) {
    flat[`snapshot.${k}`] = v;
  }
  return flat;
}

function downloadCsv(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `hrms-export-${stamp}.csv`;
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

  const csv = [
    toCsvSection(
      'EMPLOYEES',
      ['id', 'employeeCode', 'name', 'joiningDate', 'phone', 'department', 'monthlySalaryPaise', 'createdAt', 'updatedAt'],
      employees,
    ),
    toCsvSection('ATTENDANCE', ['id', 'employeeId', 'date', 'status', 'notes', 'updatedAt'], attendance),
    toCsvSection(
      'ADVANCE TRANSACTIONS',
      ['id', 'employeeId', 'date', 'type', 'amountPaise', 'notes', 'createdAt'],
      advanceTransactions,
    ),
    toCsvSection(
      'SALARY PAYMENTS',
      ['id', 'employeeId', 'date', 'amountPaise', 'method', 'notes', 'period', 'createdAt'],
      salaryPayments,
    ),
    toCsvSection(
      'SALARY FINALIZATIONS',
      [
        'id',
        'employeeId',
        'period',
        'finalizedAt',
        'advanceTransactionId',
        'paymentId',
        'snapshot.monthlySalaryPaise',
        'snapshot.divisor',
        'snapshot.totalDaysInMonth',
        'snapshot.presentDays',
        'snapshot.halfDays',
        'snapshot.unpaidAbsentDays',
        'snapshot.notMarkedDays',
        'snapshot.paidWeeklyOffDays',
        'snapshot.unpaidDayEquivalents',
        'snapshot.dailyRatePaise',
        'snapshot.attendanceDeductionPaise',
        'snapshot.otherDeductionPaise',
        'snapshot.earnedSalaryPaise',
        'snapshot.alreadyPaidPaise',
        'snapshot.availableForRecoveryPaise',
        'snapshot.outstandingAdvanceBeforePaise',
        'snapshot.maxRecoverablePaise',
        'snapshot.advanceRecoveredPaise',
        'snapshot.advanceCarriedForwardPaise',
        'snapshot.finalPayablePaise',
      ],
      salaryFinalizations.map(flattenFinalization),
    ),
  ].join('\n\n');

  downloadCsv(csv);

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
