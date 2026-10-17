import { describe, it, expect } from 'vitest';
import { calculateSalary } from '../services/salaryCalculator';

const base = {
  monthlySalaryPaise: 26_000_00, // ₹26,000 -> daily rate ₹1,000 with divisor 26
  divisor: 26,
  totalDaysInMonth: 30,
  presentDays: 24,
  halfDays: 0,
  unpaidAbsentDays: 0,
  notMarkedDays: 0,
  paidWeeklyOffDays: 4,
  otherDeductionPaise: 0,
  alreadyPaidPaise: 0,
  outstandingAdvanceBeforePaise: 0,
};

describe('calculateSalary', () => {
  it('pays full salary when there are no unpaid absences', () => {
    const result = calculateSalary(base);
    expect(result.attendanceDeductionPaise).toBe(0);
    expect(result.earnedSalaryPaise).toBe(26_000_00);
    expect(result.finalPayablePaise).toBe(26_000_00);
  });

  it('deducts a full day for each unpaid absence', () => {
    const result = calculateSalary({ ...base, presentDays: 22, unpaidAbsentDays: 2 });
    // daily rate = 2600000 / 26 = 100000 paise; 2 days => 200000 paise deduction
    expect(result.dailyRatePaise).toBe(100_000);
    expect(result.attendanceDeductionPaise).toBe(200_000);
    expect(result.earnedSalaryPaise).toBe(26_000_00 - 200_000);
  });

  it('deducts half a day for each half-day attendance', () => {
    const result = calculateSalary({ ...base, presentDays: 23, halfDays: 2 });
    // unpaid day equivalents = 0.5 * 2 = 1 day => 100000 paise
    expect(result.unpaidDayEquivalents).toBe(1);
    expect(result.attendanceDeductionPaise).toBe(100_000);
  });

  it('does not deduct for paid holidays or weekly offs', () => {
    const result = calculateSalary({ ...base, presentDays: 24 });
    expect(result.attendanceDeductionPaise).toBe(0);
    expect(result.finalPayablePaise).toBe(26_000_00);
  });

  it('never produces a negative earned salary even with excessive deductions', () => {
    const result = calculateSalary({ ...base, presentDays: 0, unpaidAbsentDays: 40 });
    expect(result.earnedSalaryPaise).toBe(0);
    expect(result.finalPayablePaise).toBe(0);
  });

  it('recovers advances up to the amount available for payment', () => {
    const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 5_000_00 });
    expect(result.advanceRecoveredPaise).toBe(5_000_00);
    expect(result.finalPayablePaise).toBe(26_000_00 - 5_000_00);
    expect(result.advanceCarriedForwardPaise).toBe(0);
  });

  it('caps advance recovery at the amount available and carries the rest forward', () => {
    const result = calculateSalary({
      ...base,
      presentDays: 0,
      unpaidAbsentDays: 30, // deduction exceeds monthly salary, zeroing out earned salary
      outstandingAdvanceBeforePaise: 10_000_00,
    });
    expect(result.availableForRecoveryPaise).toBe(0);
    expect(result.advanceRecoveredPaise).toBe(0);
    expect(result.advanceCarriedForwardPaise).toBe(10_000_00);
    expect(result.finalPayablePaise).toBe(0);
  });

  it('never pays a negative amount: already-paid amount is subtracted before recovery', () => {
    const result = calculateSalary({ ...base, alreadyPaidPaise: 20_000_00, outstandingAdvanceBeforePaise: 3_000_00 });
    expect(result.availableForRecoveryPaise).toBe(6_000_00);
    expect(result.advanceRecoveredPaise).toBe(3_000_00);
    expect(result.finalPayablePaise).toBe(3_000_00);
  });

  it('subtracts other authorized deductions before computing advance recovery', () => {
    const result = calculateSalary({ ...base, otherDeductionPaise: 1_000_00 });
    expect(result.availableForRecoveryPaise).toBe(25_000_00);
    expect(result.finalPayablePaise).toBe(25_000_00);
  });

  it('supports a calendar-days divisor as an alternative to a fixed divisor', () => {
    const result = calculateSalary({ ...base, divisor: 30, presentDays: 28, unpaidAbsentDays: 1 });
    expect(result.dailyRatePaise).toBeCloseTo(2_600_00 / 3, 5);
  });

  it('deducts for not-marked days the same as an explicit absence, but tracks them separately', () => {
    const result = calculateSalary({ ...base, presentDays: 22, notMarkedDays: 2 });
    expect(result.dailyRatePaise).toBe(100_000);
    expect(result.attendanceDeductionPaise).toBe(200_000);
    expect(result.notMarkedDays).toBe(2);
    expect(result.unpaidAbsentDays).toBe(0);
  });

  it('never lets a negative "other deduction" inflate the payable amount', () => {
    const result = calculateSalary({ ...base, otherDeductionPaise: -50_000_00 });
    expect(result.otherDeductionPaise).toBe(0);
    expect(result.finalPayablePaise).toBe(26_000_00);
  });

  it('never lets a negative already-paid amount inflate the payable amount', () => {
    const result = calculateSalary({ ...base, alreadyPaidPaise: -50_000_00 });
    expect(result.alreadyPaidPaise).toBe(0);
    expect(result.finalPayablePaise).toBe(26_000_00);
  });

  it('treats a negative outstanding advance as zero', () => {
    const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: -1_000_00 });
    expect(result.outstandingAdvanceBeforePaise).toBe(0);
    expect(result.advanceRecoveredPaise).toBe(0);
  });

  it('exposes the maximum feasible recovery alongside the actual recovered amount', () => {
    const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 5_000_00 });
    expect(result.maxRecoverablePaise).toBe(5_000_00);
    expect(result.advanceRecoveredPaise).toBe(5_000_00);
  });

  describe('explicit advanceRepaymentPaise override', () => {
    it('recovers exactly the chosen amount instead of the automatic maximum', () => {
      const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 10_000_00, advanceRepaymentPaise: 2_000_00 });
      expect(result.maxRecoverablePaise).toBe(10_000_00); // still reported, for the UI to suggest
      expect(result.advanceRecoveredPaise).toBe(2_000_00);
      expect(result.finalPayablePaise).toBe(26_000_00 - 2_000_00);
      expect(result.advanceCarriedForwardPaise).toBe(8_000_00);
    });

    it('clamps the chosen amount to the outstanding balance — cannot recover more than is owed', () => {
      const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 1_000_00, advanceRepaymentPaise: 50_000_00 });
      expect(result.advanceRecoveredPaise).toBe(1_000_00);
      expect(result.advanceCarriedForwardPaise).toBe(0);
      expect(result.finalPayablePaise).toBe(26_000_00 - 1_000_00);
    });

    it('clamps the chosen amount to what is actually available this period — final payable never goes negative', () => {
      const result = calculateSalary({
        ...base,
        presentDays: 0,
        unpaidAbsentDays: 30,
        outstandingAdvanceBeforePaise: 10_000_00,
        advanceRepaymentPaise: 10_000_00,
      });
      expect(result.availableForRecoveryPaise).toBe(0);
      expect(result.advanceRecoveredPaise).toBe(0);
      expect(result.finalPayablePaise).toBe(0);
    });

    it('rejects a negative chosen repayment amount, recovering nothing', () => {
      const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 5_000_00, advanceRepaymentPaise: -5_000_00 });
      expect(result.advanceRecoveredPaise).toBe(0);
      expect(result.finalPayablePaise).toBe(26_000_00);
    });

    it('a zero chosen amount recovers nothing, even though recovery was feasible', () => {
      const result = calculateSalary({ ...base, outstandingAdvanceBeforePaise: 5_000_00, advanceRepaymentPaise: 0 });
      expect(result.advanceRecoveredPaise).toBe(0);
      expect(result.advanceCarriedForwardPaise).toBe(5_000_00);
      expect(result.finalPayablePaise).toBe(26_000_00);
    });
  });
});
