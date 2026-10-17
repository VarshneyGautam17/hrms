import { describe, it, expect, beforeEach } from 'vitest';
import { __resetFakeFirestore } from './mocks/fakeFirestore';
import { setAttendanceStatus } from '../db/repositories/attendance';
import { giveAdvance, recordRepayment } from '../db/repositories/advances';
import { addSalaryPayment } from '../db/repositories/payments';
import { todayISO } from '../utils/dates';
import { addDays, format } from 'date-fns';

beforeEach(() => {
  __resetFakeFirestore();
});

const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

describe('future-date guards', () => {
  it('rejects marking attendance for a future date', async () => {
    await expect(setAttendanceStatus('emp1', tomorrow, 'PRESENT')).rejects.toThrow(/future/i);
  });

  it('allows marking attendance for today', async () => {
    await expect(setAttendanceStatus('emp1', todayISO(), 'PRESENT')).resolves.toBeDefined();
  });

  it('rejects giving an advance dated in the future', async () => {
    await expect(giveAdvance({ employeeId: 'emp1', date: tomorrow, amountPaise: 1000 })).rejects.toThrow(/future/i);
  });

  it('rejects recording a repayment dated in the future', async () => {
    await expect(recordRepayment({ employeeId: 'emp1', date: tomorrow, amountPaise: 1000 })).rejects.toThrow(/future/i);
  });

  it('allows an advance dated today', async () => {
    await expect(giveAdvance({ employeeId: 'emp1', date: todayISO(), amountPaise: 1000 })).resolves.toBeDefined();
  });

  it('rejects a salary payment dated in the future', async () => {
    await expect(
      addSalaryPayment({ employeeId: 'emp1', date: tomorrow, amountPaise: 1000, method: 'Salary', period: '2026-01' }),
    ).rejects.toThrow(/future/i);
  });
});
