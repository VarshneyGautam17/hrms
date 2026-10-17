// Core domain types for the Attendance & Salary Management System.
// Money is always stored as integer paise (1 rupee = 100 paise).

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  joiningDate: string; // ISO date yyyy-MM-dd
  exitDate: string | null;
  phone: string | null;
  department: string | null;
  monthlySalaryPaise: number;
  status: EmployeeStatus;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** The only three states an employee's day can be marked as. */
export type MarkedAttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT';

/** Full set of day statuses, including the one that is derived automatically (never set by hand). */
export type AttendanceStatus = MarkedAttendanceStatus | 'WEEKLY_OFF';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // ISO date yyyy-MM-dd
  status: MarkedAttendanceStatus;
  notes: string | null;
  updatedAt: string;
}

export type AdvanceTransactionType = 'ADVANCE' | 'REPAYMENT';

export interface AdvanceTransaction {
  id: string;
  employeeId: string;
  date: string;
  type: AdvanceTransactionType;
  amountPaise: number;
  notes: string | null;
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  date: string;
  amountPaise: number;
  method: string;
  notes: string | null;
  period: string; // yyyy-MM, the salary month this payment applies to
  createdAt: string;
}

export type SettlementStatus = 'DRAFT' | 'FINALIZED';

export interface SalaryCalculationSnapshot {
  monthlySalaryPaise: number;
  divisor: number;
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  paidWeeklyOffDays: number;
  unpaidDayEquivalents: number;
  dailyRatePaise: number;
  attendanceDeductionPaise: number;
  otherDeductionPaise: number;
  earnedSalaryPaise: number;
  alreadyPaidPaise: number;
  availableForRecoveryPaise: number;
  outstandingAdvanceBeforePaise: number;
  advanceRecoveredPaise: number;
  advanceCarriedForwardPaise: number;
  finalPayablePaise: number;
}

export interface SalarySettlement {
  id: string;
  employeeId: string;
  period: string; // yyyy-MM
  status: SettlementStatus;
  grossPaise: number;
  attendanceDeductionPaise: number;
  otherDeductionPaise: number;
  advanceRecoveryPaise: number;
  paidPaise: number;
  payablePaise: number;
  carriedForwardPaise: number;
  calculationSnapshot: SalaryCalculationSnapshot;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SalaryDivisorMode = 'FIXED' | 'CALENDAR_DAYS';

export interface AppSettings {
  id: string; // singleton 'default'
  salaryDivisorMode: SalaryDivisorMode;
  fixedDivisor: number;
  updatedAt: string;
}

export interface AppMetadata {
  key: string;
  value: string;
}

export const DB_SCHEMA_VERSION = 3;

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  appName: 'hrms-attendance-salary';
  data: {
    employees: Employee[];
    attendance: AttendanceRecord[];
    advanceTransactions: AdvanceTransaction[];
    salaryPayments: SalaryPayment[];
    salarySettlements: SalarySettlement[];
    settings: AppSettings[];
    appMetadata: AppMetadata[];
  };
}
