import { db } from '../database';
import type { AdvanceTransaction } from '../../types';
import { newId } from '../../utils/id';

export async function listAdvancesForEmployee(employeeId: string): Promise<AdvanceTransaction[]> {
  return db.advanceTransactions.where('employeeId').equals(employeeId).sortBy('date');
}

export async function listAllAdvances(): Promise<AdvanceTransaction[]> {
  return db.advanceTransactions.orderBy('date').toArray();
}

export async function listAdvancesInRange(
  startDate: string,
  endDate: string,
): Promise<AdvanceTransaction[]> {
  return db.advanceTransactions.where('date').between(startDate, endDate, true, true).toArray();
}

export interface NewAdvanceInput {
  employeeId: string;
  date: string;
  type: AdvanceTransaction['type'];
  amountPaise: number;
  notes?: string | null;
}

export async function addAdvanceTransaction(input: NewAdvanceInput): Promise<AdvanceTransaction> {
  if (input.amountPaise <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }
  const transaction: AdvanceTransaction = {
    id: newId(),
    employeeId: input.employeeId,
    date: input.date,
    type: input.type,
    amountPaise: input.amountPaise,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.advanceTransactions.add(transaction);
  return transaction;
}

/** Gives money to an employee (adds to their outstanding advance balance). */
export async function giveAdvance(input: { employeeId: string; date: string; amountPaise: number; notes?: string | null }) {
  return addAdvanceTransaction({ ...input, type: 'ADVANCE' });
}

/** Records money recovered/repaid against an employee's outstanding advance balance. */
export async function recordRepayment(input: { employeeId: string; date: string; amountPaise: number; notes?: string | null }) {
  return addAdvanceTransaction({ ...input, type: 'REPAYMENT' });
}

/**
 * Outstanding balance = all ADVANCE amounts minus REPAYMENT amounts, derived
 * purely from the ledger (never stored as a standalone field).
 */
export function computeOutstandingBalance(transactions: AdvanceTransaction[]): number {
  return transactions.reduce((balance, tx) => {
    if (tx.type === 'ADVANCE') return balance + tx.amountPaise;
    return balance - tx.amountPaise;
  }, 0);
}

export function sumAdvancesIssuedInPeriod(transactions: AdvanceTransaction[], period: string): number {
  return transactions
    .filter((tx) => tx.type === 'ADVANCE' && tx.date.startsWith(period))
    .reduce((sum, tx) => sum + tx.amountPaise, 0);
}
