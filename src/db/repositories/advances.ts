import { getDocs, setDoc, query, where, orderBy } from 'firebase/firestore';
import { userCollection, userDoc } from '../../firebase/paths';
import type { AdvanceTransaction } from '../../types';
import { newId } from '../../utils/id';
import { todayISO } from '../../utils/dates';

const COLLECTION = 'advanceTransactions';

export function advancesForEmployeeQuery(employeeId: string) {
  return query(userCollection(COLLECTION), where('employeeId', '==', employeeId));
}

export function allAdvancesQuery() {
  return query(userCollection(COLLECTION), orderBy('date', 'desc'));
}

export async function listAdvancesForEmployee(employeeId: string): Promise<AdvanceTransaction[]> {
  const snap = await getDocs(advancesForEmployeeQuery(employeeId));
  return snap.docs.map((d) => d.data() as AdvanceTransaction).sort((a, b) => a.date.localeCompare(b.date));
}

export async function listAllAdvances(): Promise<AdvanceTransaction[]> {
  const snap = await getDocs(allAdvancesQuery());
  return snap.docs.map((d) => d.data() as AdvanceTransaction);
}

export async function listAdvancesInRange(startDate: string, endDate: string): Promise<AdvanceTransaction[]> {
  const snap = await getDocs(
    query(userCollection(COLLECTION), where('date', '>=', startDate), where('date', '<=', endDate)),
  );
  return snap.docs.map((d) => d.data() as AdvanceTransaction);
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
  if (input.date > todayISO()) {
    throw new Error('Advance transactions cannot be dated in the future.');
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
  await setDoc(userDoc(COLLECTION, transaction.id), transaction);
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
