import { db } from '../database';
import type { SalaryPayment } from '../../types';
import { newId } from '../../utils/id';

export async function listPaymentsForEmployee(employeeId: string): Promise<SalaryPayment[]> {
  return db.salaryPayments.where('employeeId').equals(employeeId).sortBy('date');
}

export async function listPaymentsForEmployeePeriod(
  employeeId: string,
  period: string,
): Promise<SalaryPayment[]> {
  const all = await listPaymentsForEmployee(employeeId);
  return all.filter((p) => p.period === period);
}

export async function listPaymentsForPeriod(period: string): Promise<SalaryPayment[]> {
  return db.salaryPayments.where('period').equals(period).toArray();
}

export interface NewPaymentInput {
  employeeId: string;
  date: string;
  amountPaise: number;
  method: string;
  period: string;
  notes?: string | null;
}

export async function addSalaryPayment(input: NewPaymentInput): Promise<SalaryPayment> {
  if (input.amountPaise <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const payment: SalaryPayment = {
    id: newId(),
    employeeId: input.employeeId,
    date: input.date,
    amountPaise: input.amountPaise,
    method: input.method,
    period: input.period,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.salaryPayments.add(payment);
  return payment;
}

export function sumPayments(payments: SalaryPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amountPaise, 0);
}
