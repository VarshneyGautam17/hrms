import { getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { userCollection, userDoc } from '../firebase/paths';
import { firestore } from '../firebase/config';
import { createDefaultSettings } from '../db/repositories/settings';
import type { BackupFile, Employee, AttendanceRecord, AdvanceTransaction, SalaryPayment, AppSettings } from '../types';
import { DB_SCHEMA_VERSION } from '../types';

const COLLECTIONS = ['employees', 'attendance', 'advanceTransactions', 'salaryPayments'] as const;

async function fetchAll<T>(name: string): Promise<T[]> {
  const snap = await getDocs(userCollection(name));
  return snap.docs.map((d) => d.data() as T);
}

export async function exportBackup(): Promise<BackupFile> {
  const [employees, attendance, advanceTransactions, salaryPayments, settingsRow] = await Promise.all([
    fetchAll<Employee>('employees'),
    fetchAll<AttendanceRecord>('attendance'),
    fetchAll<AdvanceTransaction>('advanceTransactions'),
    fetchAll<SalaryPayment>('salaryPayments'),
    fetchAll<AppSettings>('settings'),
  ]);

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'hrms-attendance-salary',
    data: {
      employees,
      attendance,
      advanceTransactions,
      salaryPayments,
      settings: settingsRow,
    },
  };
}

export function downloadBackupFile(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = backup.exportedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `hrms-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ValidationIssue {
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  recordCounts: Record<string, number>;
}

const REQUIRED_COLLECTIONS = ['employees', 'attendance', 'advanceTransactions', 'salaryPayments', 'settings'] as const;

export function validateBackup(raw: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const recordCounts: Record<string, number> = {};

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, issues: [{ message: 'Backup file is not valid JSON object.' }], recordCounts };
  }

  const backup = raw as Partial<BackupFile>;

  if (typeof backup.schemaVersion !== 'number') {
    issues.push({ message: 'Missing or invalid schemaVersion.' });
  } else if (backup.schemaVersion > DB_SCHEMA_VERSION) {
    issues.push({
      message: `Backup schema version ${backup.schemaVersion} is newer than this app supports (${DB_SCHEMA_VERSION}).`,
    });
  }

  if (backup.appName !== 'hrms-attendance-salary') {
    issues.push({ message: 'This file does not look like an HRMS backup (unexpected appName).' });
  }

  if (!backup.data || typeof backup.data !== 'object') {
    issues.push({ message: 'Backup is missing its data section.' });
    return { valid: false, issues, recordCounts };
  }

  for (const key of REQUIRED_COLLECTIONS) {
    const value = (backup.data as Record<string, unknown>)[key];
    if (!Array.isArray(value)) {
      issues.push({ message: `Missing or invalid collection: ${key}.` });
      continue;
    }
    recordCounts[key] = value.length;
  }

  // Duplicate ID detection within each collection that has an `id` field.
  for (const key of REQUIRED_COLLECTIONS) {
    const value = (backup.data as Record<string, unknown>)[key];
    if (!Array.isArray(value)) continue;
    const ids = new Set<string>();
    for (const row of value) {
      const id = (row as { id?: unknown })?.id;
      if (typeof id !== 'string' || id.length === 0) {
        issues.push({ message: `A record in ${key} is missing a valid id.` });
        continue;
      }
      if (ids.has(id)) {
        issues.push({ message: `Duplicate id "${id}" found in ${key}.` });
      }
      ids.add(id);
    }
  }

  return { valid: issues.length === 0, issues, recordCounts };
}

/** Firestore batches top out at 500 writes; chunk anything larger. */
async function batchWriteAll(docs: { path: string; id: string; data: object }[]): Promise<void> {
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const d of docs.slice(i, i + 450)) {
      batch.set(userDoc(d.path, d.id), d.data);
    }
    await batch.commit();
  }
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
 * Replaces all current data with the contents of a validated backup.
 * Clears every collection first, then writes the backup's rows back in.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  for (const name of REQUIRED_COLLECTIONS) {
    await deleteAllInCollection(name);
  }

  await batchWriteAll(backup.data.employees.map((e) => ({ path: 'employees', id: e.id, data: e })));
  await batchWriteAll(backup.data.attendance.map((a) => ({ path: 'attendance', id: `${a.employeeId}_${a.date}`, data: a })));
  await batchWriteAll(backup.data.advanceTransactions.map((a) => ({ path: 'advanceTransactions', id: a.id, data: a })));
  await batchWriteAll(backup.data.salaryPayments.map((p) => ({ path: 'salaryPayments', id: p.id, data: p })));
  for (const s of backup.data.settings) {
    await setDoc(userDoc('settings', s.id), s);
  }
}

export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Permanently wipes every employee, attendance, advance, payment and
 * settings record for the signed-in user, then re-seeds the default
 * settings doc. There is no undo — export a backup first if the data might
 * still be needed.
 */
export async function resetAllData(): Promise<void> {
  for (const name of COLLECTIONS) {
    await deleteAllInCollection(name);
  }
  await setDoc(userDoc('settings', 'default'), createDefaultSettings());
}
