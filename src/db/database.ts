import Dexie, { type Table } from 'dexie';
import type { Employee, AttendanceRecord, AdvanceTransaction, SalaryPayment, AppSettings, AppMetadata } from '../types';

export const DEFAULT_SETTINGS_ID = 'default';

export class HrmsDatabase extends Dexie {
  employees!: Table<Employee, string>;
  attendance!: Table<AttendanceRecord, string>;
  advanceTransactions!: Table<AdvanceTransaction, string>;
  salaryPayments!: Table<SalaryPayment, string>;
  settings!: Table<AppSettings, string>;
  appMetadata!: Table<AppMetadata, string>;

  constructor() {
    super('hrms-attendance-salary');

    // Schema version 1 (Phase 1) — punch in/out based attendance, leave records.
    this.version(1).stores({
      employees: 'id, employeeCode, name, status',
      attendance: 'id, &[employeeId+date], employeeId, date, status',
      holidays: 'id, &date',
      leaveRecords: 'id, employeeId, startDate, endDate',
      advanceTransactions: 'id, employeeId, date, type',
      salaryPayments: 'id, employeeId, date, period',
      salarySettlements: 'id, &[employeeId+period], employeeId, period, status',
      settings: 'id',
      appMetadata: 'key',
    });

    // Schema version 2 — simplified attendance (Present/Half Day/Absent only,
    // no punch times), leave tracking removed, advances limited to
    // Advance/Repayment.
    this.version(2)
      .stores({
        employees: 'id, employeeCode, name, status',
        attendance: 'id, &[employeeId+date], employeeId, date, status',
        holidays: 'id, &date',
        leaveRecords: null, // drop table
        advanceTransactions: 'id, employeeId, date, type',
        salaryPayments: 'id, employeeId, date, period',
        salarySettlements: 'id, &[employeeId+period], employeeId, period, status',
        settings: 'id',
        appMetadata: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('attendance')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            const legacyStatus = record.status as string;
            record.status = legacyStatus === 'FULL_PRESENT' ? 'PRESENT' : legacyStatus === 'HALF_DAY' ? 'HALF_DAY' : legacyStatus === 'ABSENT' ? 'ABSENT' : 'ABSENT';
            delete record.punchIn;
            delete record.punchOut;
            delete record.breakMinutes;
            delete record.workingMinutes;
            delete record.lateMinutes;
            delete record.isOverride;
            delete record.overrideReason;
            delete record.flaggedForReview;
          });

        await tx
          .table('advanceTransactions')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            if (record.type === 'ADJUSTMENT') record.type = 'REPAYMENT';
          });

        await tx
          .table('settings')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            delete record.shiftStart;
            delete record.shiftEnd;
            delete record.graceMinutes;
            delete record.fullDayMinutes;
            delete record.halfDayMinutes;
            delete record.breakMinutesDefault;
            delete record.lateAffectsStatus;
          });
      });

    // Schema version 3 — holidays removed entirely; weekly off is now a fixed
    // rule (every Monday) instead of a configurable setting.
    this.version(3)
      .stores({
        employees: 'id, employeeCode, name, status',
        attendance: 'id, &[employeeId+date], employeeId, date, status',
        holidays: null, // drop table
        advanceTransactions: 'id, employeeId, date, type',
        salaryPayments: 'id, employeeId, date, period',
        salarySettlements: 'id, &[employeeId+period], employeeId, period, status',
        settings: 'id',
        appMetadata: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('settings')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            delete record.weeklyOffDays;
          });
      });

    // Schema version 4 — active/inactive employee status removed entirely;
    // every employee is simply always counted.
    this.version(4)
      .stores({
        employees: 'id, employeeCode, name',
        attendance: 'id, &[employeeId+date], employeeId, date, status',
        advanceTransactions: 'id, employeeId, date, type',
        salaryPayments: 'id, employeeId, date, period',
        salarySettlements: 'id, &[employeeId+period], employeeId, period, status',
        settings: 'id',
        appMetadata: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('employees')
          .toCollection()
          .modify((record: Record<string, unknown>) => {
            delete record.status;
            delete record.exitDate;
          });
      });

    // Schema version 5 — "finalize settlement" removed entirely; salary is
    // always a live calculation, never persisted/locked in.
    this.version(5).stores({
      employees: 'id, employeeCode, name',
      attendance: 'id, &[employeeId+date], employeeId, date, status',
      advanceTransactions: 'id, employeeId, date, type',
      salaryPayments: 'id, employeeId, date, period',
      salarySettlements: null, // drop table
      settings: 'id',
      appMetadata: 'key',
    });
  }
}

export const db = new HrmsDatabase();

export function createDefaultSettings(): AppSettings {
  return {
    id: DEFAULT_SETTINGS_ID,
    salaryDivisorMode: 'FIXED',
    fixedDivisor: 26,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates the default settings row if one doesn't exist yet. This writes to
 * the database, so it must only be called from app bootstrap or an event
 * handler — never from inside a `useLiveQuery` querier (Dexie's live-query
 * context is read-only).
 */
export async function ensureDefaultSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(DEFAULT_SETTINGS_ID);
  if (existing) return existing;
  const defaults = createDefaultSettings();
  await db.settings.put(defaults);
  return defaults;
}

export async function getAppMetadata(key: string): Promise<string | undefined> {
  const row = await db.appMetadata.get(key);
  return row?.value;
}

export async function setAppMetadata(key: string, value: string): Promise<void> {
  await db.appMetadata.put({ key, value });
}
