import { describe, it, expect } from 'vitest';
import { buildExportCsv, type ExportData } from '../services/backupService';
import { calculateSalary } from '../services/salaryCalculator';

const employee = {
  id: 'internal-id-123',
  employeeCode: '007',
  name: 'Ramesh Kumar',
  joiningDate: '2026-01-05',
  phone: '09876543210',
  department: 'Stores',
  monthlySalaryPaise: 10_000_00,
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-01-05T10:00:00.000Z',
};

const data: ExportData = {
  employees: [employee],
  attendance: [{ id: 'att-1', employeeId: employee.id, date: '2026-10-01', status: 'HALF_DAY', notes: null, updatedAt: '' }],
  advanceTransactions: [
    { id: 'adv-1', employeeId: employee.id, date: '2026-10-02', type: 'REPAYMENT', amountPaise: 1_500_50, notes: 'cash, "late"', createdAt: '' },
  ],
  salaryPayments: [],
  salaryFinalizations: [
    {
      id: 'fin-1',
      employeeId: employee.id,
      period: '2026-09',
      finalizedAt: '2026-10-01T05:30:00.000Z',
      advanceTransactionId: 'adv-x',
      paymentId: 'pay-x',
      snapshot: calculateSalary({
        monthlySalaryPaise: 30_000_00,
        divisor: 30,
        totalDaysInMonth: 30,
        presentDays: 26,
        halfDays: 0,
        unpaidAbsentDays: 0,
        notMarkedDays: 0,
        paidWeeklyOffDays: 4,
        otherDeductionPaise: 0,
        alreadyPaidPaise: 0,
        outstandingAdvanceBeforePaise: 0,
      }),
    },
  ],
};

describe('buildExportCsv', () => {
  const csv = buildExportCsv(data);
  const lines = csv.split('\n');

  it('never shows internal ids — employees appear by name and code', () => {
    for (const id of ['internal-id-123', 'att-1', 'adv-1', 'fin-1', 'adv-x', 'pay-x']) {
      expect(csv).not.toContain(id);
    }
    expect(lines).toContain('"=""01 Oct 2026""",Ramesh Kumar,"=""007""",Half Day,');
  });

  it('writes amounts in rupees with readable labels, and escapes quotes and commas', () => {
    expect(lines).toContain('"=""02 Oct 2026""",Ramesh Kumar,"=""007""",Advance Returned,1500.5,"cash, ""late"""');
  });

  it('keeps dates, codes and phone numbers as text so Excel never shows ####', () => {
    expect(lines).toContain('"=""007""",Ramesh Kumar,Stores,"=""09876543210""","=""05 Jan 2026""",10000');
  });

  it('exports finalized salaries with month names and the full breakdown', () => {
    const header = lines[lines.indexOf('FINALIZED SALARIES') + 1];
    expect(header).toContain('Final Payable (Rs)');
    const row = lines[lines.indexOf('FINALIZED SALARIES') + 2];
    expect(row.startsWith('"=""September 2026""",Ramesh Kumar,')).toBe(true);
    expect(row.endsWith(',30000')).toBe(true);
  });

  it('starts with a byte-order mark so Excel reads it as UTF-8', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
