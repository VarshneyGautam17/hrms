import { db } from '../db/database';
import type { BackupFile } from '../types';
import { DB_SCHEMA_VERSION } from '../types';

export async function exportBackup(): Promise<BackupFile> {
  const [employees, attendance, holidays, advanceTransactions, salaryPayments, salarySettlements, settings, appMetadata] =
    await Promise.all([
      db.employees.toArray(),
      db.attendance.toArray(),
      db.holidays.toArray(),
      db.advanceTransactions.toArray(),
      db.salaryPayments.toArray(),
      db.salarySettlements.toArray(),
      db.settings.toArray(),
      db.appMetadata.toArray(),
    ]);

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'hrms-attendance-salary',
    data: {
      employees,
      attendance,
      holidays,
      advanceTransactions,
      salaryPayments,
      salarySettlements,
      settings,
      appMetadata,
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

const REQUIRED_COLLECTIONS = [
  'employees',
  'attendance',
  'holidays',
  'advanceTransactions',
  'salaryPayments',
  'salarySettlements',
  'settings',
  'appMetadata',
] as const;

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
    if (key === 'appMetadata') continue; // keyed by `key`, not `id`
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

/**
 * Replaces all local data with the contents of a validated backup, inside a
 * single IndexedDB transaction so a failure leaves existing data untouched.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.employees,
      db.attendance,
      db.holidays,
      db.advanceTransactions,
      db.salaryPayments,
      db.salarySettlements,
      db.settings,
      db.appMetadata,
    ],
    async () => {
      await Promise.all([
        db.employees.clear(),
        db.attendance.clear(),
        db.holidays.clear(),
        db.advanceTransactions.clear(),
        db.salaryPayments.clear(),
        db.salarySettlements.clear(),
        db.settings.clear(),
        db.appMetadata.clear(),
      ]);

      await Promise.all([
        db.employees.bulkAdd(backup.data.employees),
        db.attendance.bulkAdd(backup.data.attendance),
        db.holidays.bulkAdd(backup.data.holidays),
        db.advanceTransactions.bulkAdd(backup.data.advanceTransactions),
        db.salaryPayments.bulkAdd(backup.data.salaryPayments),
        db.salarySettlements.bulkAdd(backup.data.salarySettlements),
        db.settings.bulkAdd(backup.data.settings),
        db.appMetadata.bulkAdd(backup.data.appMetadata),
      ]);
    },
  );
}

export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}
