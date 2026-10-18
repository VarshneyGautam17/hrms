import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { buildSalarySlipPdf, salarySlipFileName } from '../services/pdfService';
import { calculateSalary } from '../services/salaryCalculator';
import type { SalarySlip } from '../services/salaryService';

function slipFor(name: string, employeeCode: string, period: string): SalarySlip {
  return { employee: { name, employeeCode }, period } as SalarySlip;
}

describe('salarySlipFileName', () => {
  it('contains the employee name, employee id, month and download date/time', () => {
    const name = salarySlipFileName(slipFor('Ramesh Kumar', 'E001', '2026-10'), new Date(2026, 9, 18, 9, 5));
    expect(name).toBe('Salary-Slip_Ramesh-Kumar_E001_Oct-2026_2026-10-18_09-05.pdf');
  });

  it('strips characters that are not allowed in file names', () => {
    const name = salarySlipFileName(slipFor(' A/B: "C" ', 'E*1', '2026-02'), new Date(2026, 1, 3, 14, 30));
    expect(name).toBe('Salary-Slip_AB-C_E1_Feb-2026_2026-02-03_14-30.pdf');
  });
});

describe('buildSalarySlipPdf', () => {
  it('fits the whole slip on a single A4 page, even for a finalized slip with every line filled', () => {
    const snapshot = calculateSalary({
      monthlySalaryPaise: 31_000_00,
      divisor: 31,
      totalDaysInMonth: 31,
      presentDays: 20,
      halfDays: 2,
      unpaidAbsentDays: 2,
      notMarkedDays: 2,
      paidWeeklyOffDays: 5,
      weeklyOffWorkedDays: 1.5,
      otherDeductionPaise: 500_00,
      alreadyPaidPaise: 1_000_00,
      outstandingAdvanceBeforePaise: 5_000_00,
    });
    const slip = {
      employee: { name: 'Ramesh Kumar', employeeCode: 'E001', department: 'Stores' },
      period: '2026-10',
      days: [],
      snapshot,
      finalized: true,
      finalizedAt: '2026-10-31T10:00:00.000Z',
    } as unknown as SalarySlip;

    // jsPDF never adds pages on its own — text past the bottom is just cut off —
    // so check where every line of text actually lands.
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const textSpy = vi.spyOn(doc, 'text');
    buildSalarySlipPdf(slip, new Date(), 'Printed', doc);
    const textYs = textSpy.mock.calls.map((call) => call[2] as number);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(textYs.length).toBeGreaterThan(30);
    expect(Math.max(...textYs)).toBeLessThan(doc.internal.pageSize.getHeight() - 36); // keeps a ½-inch bottom margin
  });
});
