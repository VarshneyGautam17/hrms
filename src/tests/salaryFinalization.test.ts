import { describe, it, expect, beforeEach } from 'vitest';
import { __resetFakeFirestore } from './mocks/fakeFirestore';
import { createEmployee } from '../db/repositories/employees';
import { setAttendanceStatus } from '../db/repositories/attendance';
import { addAdvanceTransaction, computeOutstandingBalance, listAdvancesForEmployee } from '../db/repositories/advances';
import { updateSettings } from '../db/repositories/settings';
import { computeSalarySlip, finalizeSalary } from '../services/salaryService';
import { daysInPeriod } from '../utils/dates';

const PERIOD = '2026-02'; // 28 days

beforeEach(async () => {
  __resetFakeFirestore();
  await updateSettings({ weeklyOffDay: 1 });
});

async function markPresentForAllDays(employeeId: string, period: string, excludeDates: string[] = []) {
  for (const date of daysInPeriod(period)) {
    if (excludeDates.includes(date)) continue;
    await setAttendanceStatus(employeeId, date, 'PRESENT');
  }
}

describe('finalizeSalary', () => {
  it('records a real repayment transaction for the advance actually recovered', async () => {
    const employee = await createEmployee({ employeeCode: 'F1', name: 'Finalize One', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-05', type: 'ADVANCE', amountPaise: 5_000_00 });

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.advanceRecoveredPaise).toBe(5_000_00);

    await finalizeSalary(employee.id, slip, null);

    const advances = await listAdvancesForEmployee(employee.id);
    expect(computeOutstandingBalance(advances)).toBe(0); // actually recovered now, not just displayed
    expect(advances.some((a) => a.type === 'REPAYMENT' && a.amountPaise === 5_000_00)).toBe(true);
  });

  it('respects an explicit, smaller advance-repayment override instead of recovering the maximum', async () => {
    const employee = await createEmployee({ employeeCode: 'F2', name: 'Finalize Two', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-05', type: 'ADVANCE', amountPaise: 10_000_00 });

    const slip = await computeSalarySlip(employee.id, PERIOD, 0, 2_000_00);
    expect(slip.snapshot.advanceRecoveredPaise).toBe(2_000_00);
    expect(slip.snapshot.finalPayablePaise).toBe(26_000_00 - 2_000_00);

    await finalizeSalary(employee.id, slip, null);

    const advances = await listAdvancesForEmployee(employee.id);
    expect(computeOutstandingBalance(advances)).toBe(8_000_00); // only the chosen 2,000 was recovered, 8,000 remains owed
  });

  it('never creates a repayment transaction when nothing was recovered', async () => {
    const employee = await createEmployee({ employeeCode: 'F3', name: 'Finalize Three', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.advanceRecoveredPaise).toBe(0);

    await finalizeSalary(employee.id, slip, null);

    expect(await listAdvancesForEmployee(employee.id)).toHaveLength(0);
  });

  it('allows finalizing a period where the final payable is exactly zero', async () => {
    const employee = await createEmployee({ employeeCode: 'F4', name: 'Finalize Four', joiningDate: '2026-01-01', monthlySalaryPaise: 10_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-01', type: 'ADVANCE', amountPaise: 15_000_00 });

    const slip = await computeSalarySlip(employee.id, PERIOD);
    expect(slip.snapshot.finalPayablePaise).toBe(0);

    await expect(finalizeSalary(employee.id, slip, null)).resolves.toBeDefined();
  });

  it('freezes the slip permanently: later attendance or advance changes never alter a finalized period', async () => {
    const employee = await createEmployee({ employeeCode: 'F5', name: 'Finalize Five', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-05', type: 'ADVANCE', amountPaise: 5_000_00 });

    const before = await computeSalarySlip(employee.id, PERIOD);
    await finalizeSalary(employee.id, before, null);

    // Mutate attendance for that same period after finalizing — a real scenario
    // where someone edits a past day by mistake.
    await setAttendanceStatus(employee.id, '2026-02-10', 'ABSENT');
    await addAdvanceTransaction({ employeeId: employee.id, date: '2026-02-20', type: 'ADVANCE', amountPaise: 50_000_00 });

    const after = await computeSalarySlip(employee.id, PERIOD);
    expect(after.finalized).toBe(true);
    expect(after.snapshot).toEqual(before.snapshot); // byte-for-byte frozen — no double counting, no silent drift
  });

  it('refuses to finalize the same employee/period twice, even with a stale slip object', async () => {
    const employee = await createEmployee({ employeeCode: 'F6', name: 'Finalize Six', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);

    const slip = await computeSalarySlip(employee.id, PERIOD);
    await finalizeSalary(employee.id, slip, null); // first call succeeds

    // Second call reuses the same (now stale) non-finalized slip snapshot — the
    // repository-level duplicate check must still catch it.
    await expect(finalizeSalary(employee.id, slip, null)).rejects.toThrow(/already finalized/i);

    const advances = await listAdvancesForEmployee(employee.id);
    expect(advances).toHaveLength(0); // no duplicate repayment was created by the rejected second call
  });

  it('a freshly re-fetched slip for an already-finalized period reports finalized and cannot be finalized again', async () => {
    const employee = await createEmployee({ employeeCode: 'F7', name: 'Finalize Seven', joiningDate: '2026-01-01', monthlySalaryPaise: 26_000_00 });
    await markPresentForAllDays(employee.id, PERIOD);

    const slip = await computeSalarySlip(employee.id, PERIOD);
    await finalizeSalary(employee.id, slip, null);

    const refetched = await computeSalarySlip(employee.id, PERIOD);
    expect(refetched.finalized).toBe(true);
    await expect(finalizeSalary(employee.id, refetched, null)).rejects.toThrow(/already finalized/i);
  });
});
