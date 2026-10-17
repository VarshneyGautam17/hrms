import type { SalaryCalculationSnapshot } from '../types';

export interface SalaryCalculationInput {
  monthlySalaryPaise: number;
  divisor: number;
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  unpaidAbsentDays: number;
  paidWeeklyOffDays: number;
  /** Other authorized deductions (e.g. manual adjustments), in paise. */
  otherDeductionPaise: number;
  /** Salary already paid out for this period, in paise. */
  alreadyPaidPaise: number;
  /** Outstanding advance balance eligible for recovery this period, in paise. */
  outstandingAdvanceBeforePaise: number;
  /**
   * How much of the outstanding advance to deduct this period, in paise.
   * Omit to automatically recover the maximum possible (the old default
   * behavior). When given, it caps recovery even if more could be recovered.
   */
  advanceDeductionRequestedPaise?: number;
}

/**
 * Deterministic, side-effect-free salary calculation. Mirrors the spec's
 * formulas exactly so results are independently testable and auditable.
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationSnapshot {
  const divisor = input.divisor > 0 ? input.divisor : 1;
  const dailyRatePaise = input.monthlySalaryPaise / divisor;

  const unpaidDayEquivalents = input.unpaidAbsentDays + 0.5 * input.halfDays;

  const attendanceDeductionPaise = Math.round(dailyRatePaise * unpaidDayEquivalents);

  const earnedSalaryPaise = Math.max(0, Math.round(input.monthlySalaryPaise - attendanceDeductionPaise));

  const availableForRecoveryPaise = Math.max(
    0,
    Math.round(earnedSalaryPaise - input.otherDeductionPaise - input.alreadyPaidPaise),
  );

  const outstanding = Math.max(0, input.outstandingAdvanceBeforePaise);
  const requestedCap =
    input.advanceDeductionRequestedPaise === undefined ? Infinity : Math.max(0, input.advanceDeductionRequestedPaise);
  const advanceRecoveredPaise = Math.min(outstanding, availableForRecoveryPaise, requestedCap);

  const finalPayablePaise = availableForRecoveryPaise - advanceRecoveredPaise;
  const advanceCarriedForwardPaise = outstanding - advanceRecoveredPaise;

  return {
    monthlySalaryPaise: input.monthlySalaryPaise,
    divisor,
    totalDaysInMonth: input.totalDaysInMonth,
    presentDays: input.presentDays,
    halfDays: input.halfDays,
    unpaidAbsentDays: input.unpaidAbsentDays,
    paidWeeklyOffDays: input.paidWeeklyOffDays,
    unpaidDayEquivalents,
    dailyRatePaise,
    attendanceDeductionPaise,
    otherDeductionPaise: input.otherDeductionPaise,
    earnedSalaryPaise,
    alreadyPaidPaise: input.alreadyPaidPaise,
    availableForRecoveryPaise,
    outstandingAdvanceBeforePaise: outstanding,
    advanceRecoveredPaise,
    advanceCarriedForwardPaise,
    finalPayablePaise,
  };
}
