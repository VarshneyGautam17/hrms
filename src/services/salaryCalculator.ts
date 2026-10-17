import type { SalaryCalculationSnapshot } from '../types';

export interface SalaryCalculationInput {
  monthlySalaryPaise: number;
  divisor: number;
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  /** Days nobody marked at all. Still unpaid (same as an explicit absence), tracked separately so it can be labeled distinctly from "Absent". */
  notMarkedDays: number;
  paidWeeklyOffDays: number;
  /** Other authorized deductions (e.g. manual adjustments), in paise. */
  otherDeductionPaise: number;
  /** Salary already paid out for this period, in paise. */
  alreadyPaidPaise: number;
  /** Outstanding advance balance eligible for recovery this period, in paise. */
  outstandingAdvanceBeforePaise: number;
  /**
   * Explicit, admin-chosen advance repayment amount for this period, in
   * paise. When omitted, the full feasible amount (min(outstanding,
   * available-for-recovery)) is recovered automatically, as before. When
   * provided, it is clamped to what's actually recoverable and used
   * instead — this is what the "Advance Repayment" field on the salary
   * slip ultimately drives, and the amount that gets written to the
   * advance ledger when the slip is finalized.
   */
  advanceRepaymentPaise?: number;
}

/** Never trust a raw number as a non-negative, finite paise amount without checking. */
function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Deterministic, side-effect-free salary calculation. Mirrors the spec's
 * formulas exactly so results are independently testable and auditable.
 * Every monetary input is defensively clamped to a non-negative, finite
 * value — a stray negative "deduction" must never be able to inflate the
 * final payable amount.
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationSnapshot {
  const divisor = input.divisor > 0 ? input.divisor : 1;
  const monthlySalaryPaise = nonNegative(input.monthlySalaryPaise);
  const otherDeductionPaise = nonNegative(input.otherDeductionPaise);
  const alreadyPaidPaise = nonNegative(input.alreadyPaidPaise);
  const dailyRatePaise = monthlySalaryPaise / divisor;

  const unpaidDayEquivalents = input.unpaidAbsentDays + input.notMarkedDays + 0.5 * input.halfDays;

  const attendanceDeductionPaise = Math.round(dailyRatePaise * unpaidDayEquivalents);

  const earnedSalaryPaise = Math.max(0, Math.round(monthlySalaryPaise - attendanceDeductionPaise));

  const availableForRecoveryPaise = Math.max(0, Math.round(earnedSalaryPaise - otherDeductionPaise - alreadyPaidPaise));

  const outstanding = nonNegative(input.outstandingAdvanceBeforePaise);
  const maxRecoverablePaise = Math.min(outstanding, availableForRecoveryPaise);
  const advanceRecoveredPaise =
    input.advanceRepaymentPaise === undefined ? maxRecoverablePaise : Math.min(maxRecoverablePaise, nonNegative(input.advanceRepaymentPaise));

  const finalPayablePaise = availableForRecoveryPaise - advanceRecoveredPaise;
  const advanceCarriedForwardPaise = outstanding - advanceRecoveredPaise;

  return {
    monthlySalaryPaise,
    divisor,
    totalDaysInMonth: input.totalDaysInMonth,
    presentDays: input.presentDays,
    halfDays: input.halfDays,
    unpaidAbsentDays: input.unpaidAbsentDays,
    notMarkedDays: input.notMarkedDays,
    paidWeeklyOffDays: input.paidWeeklyOffDays,
    unpaidDayEquivalents,
    dailyRatePaise,
    attendanceDeductionPaise,
    otherDeductionPaise,
    earnedSalaryPaise,
    alreadyPaidPaise,
    availableForRecoveryPaise,
    outstandingAdvanceBeforePaise: outstanding,
    maxRecoverablePaise,
    advanceRecoveredPaise,
    advanceCarriedForwardPaise,
    finalPayablePaise,
  };
}
