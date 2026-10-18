// Core domain types for the Attendance & Salary Management System.
// Money is always stored as integer paise (1 rupee = 100 paise).

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  joiningDate: string; // ISO date yyyy-MM-dd
  phone: string | null;
  department: string | null;
  monthlySalaryPaise: number;
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

export interface SalaryFinalization {
  id: string; // `${employeeId}_${period}` — one finalization per employee per period, ever.
  employeeId: string;
  period: string; // yyyy-MM
  finalizedAt: string; // ISO datetime
  /** The exact calculation as it was at the moment of finalization — never recomputed afterwards. */
  snapshot: SalaryCalculationSnapshot;
  /** The advance-ledger repayment transaction created by this finalization, if any was recovered. */
  advanceTransactionId: string | null;
  /** The salary-payment record created by this finalization. */
  paymentId: string;
}

export interface SalaryCalculationSnapshot {
  monthlySalaryPaise: number;
  divisor: number;
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  notMarkedDays: number;
  paidWeeklyOffDays: number;
  /** Weekly off days the employee still came to work (half day = 0.5). Missing on older snapshots. */
  weeklyOffWorkedDays?: number;
  /** Extra pay for weekly-off work: per day rate × weeklyOffWorkedDays. Missing on older snapshots. */
  weeklyOffExtraPaise?: number;
  unpaidDayEquivalents: number;
  /** Present + 0.5 × half days + paid weekly offs. Missing on snapshots finalized before salary became earned-per-day. */
  paidDayEquivalents?: number;
  dailyRatePaise: number;
  attendanceDeductionPaise: number;
  otherDeductionPaise: number;
  earnedSalaryPaise: number;
  alreadyPaidPaise: number;
  availableForRecoveryPaise: number;
  outstandingAdvanceBeforePaise: number;
  /** The maximum that could be auto-recovered this period: min(outstanding, available-for-recovery). */
  maxRecoverablePaise: number;
  advanceRecoveredPaise: number;
  advanceCarriedForwardPaise: number;
  finalPayablePaise: number;
}

export interface AppSettings {
  id: string; // singleton 'default'
  /** Which weekday is the company-wide paid weekly off, for all employees (0 = Sunday ... 6 = Saturday). */
  weeklyOffDay: number;
  updatedAt: string;
}

