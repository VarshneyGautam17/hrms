import { getDocs, setDoc, query, where } from 'firebase/firestore';
import { userCollection, userDoc } from '../../firebase/paths';
import type { SalaryPayment } from '../../types';
import { newId } from '../../utils/id';
import { todayISO } from '../../utils/dates';

const COLLECTION = 'salaryPayments';

export async function listPaymentsForEmployee(employeeId: string): Promise<SalaryPayment[]> {
  const snap = await getDocs(query(userCollection(COLLECTION), where('employeeId', '==', employeeId)));
  return snap.docs.map((d) => d.data() as SalaryPayment).sort((a, b) => a.date.localeCompare(b.date));
}

export async function listPaymentsForEmployeePeriod(employeeId: string, period: string): Promise<SalaryPayment[]> {
  const all = await listPaymentsForEmployee(employeeId);
  return all.filter((p) => p.period === period);
}

export async function listPaymentsForPeriod(period: string): Promise<SalaryPayment[]> {
  const snap = await getDocs(query(userCollection(COLLECTION), where('period', '==', period)));
  return snap.docs.map((d) => d.data() as SalaryPayment);
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
  if (input.amountPaise < 0) {
    throw new Error('Payment amount cannot be negative.');
  }
  if (input.date > todayISO()) {
    throw new Error('Salary payments cannot be dated in the future.');
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
  await setDoc(userDoc(COLLECTION, payment.id), payment);
  return payment;
}

export function sumPayments(payments: SalaryPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amountPaise, 0);
}
