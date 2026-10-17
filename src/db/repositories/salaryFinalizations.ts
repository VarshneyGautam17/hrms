import { getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { userCollection, userDoc } from '../../firebase/paths';
import type { SalaryCalculationSnapshot, SalaryFinalization } from '../../types';

const COLLECTION = 'salaryFinalizations';

function docId(employeeId: string, period: string): string {
  return `${employeeId}_${period}`;
}

export function finalizationDocRef(employeeId: string, period: string) {
  return userDoc(COLLECTION, docId(employeeId, period));
}

export async function getFinalization(employeeId: string, period: string): Promise<SalaryFinalization | undefined> {
  const snap = await getDoc(finalizationDocRef(employeeId, period));
  return snap.exists() ? (snap.data() as SalaryFinalization) : undefined;
}

export async function listFinalizationsForEmployee(employeeId: string): Promise<SalaryFinalization[]> {
  const snap = await getDocs(query(userCollection(COLLECTION), where('employeeId', '==', employeeId)));
  return snap.docs.map((d) => d.data() as SalaryFinalization);
}

export interface NewFinalizationInput {
  employeeId: string;
  period: string;
  snapshot: SalaryCalculationSnapshot;
  advanceTransactionId: string | null;
  paymentId: string;
  emailedTo: string | null;
}

/**
 * Freezes a salary period permanently. Throws if this employee/period was
 * already finalized — finalizing is a one-way, one-time action; there is no
 * re-finalize or undo path.
 */
export async function createFinalization(input: NewFinalizationInput): Promise<SalaryFinalization> {
  const existing = await getFinalization(input.employeeId, input.period);
  if (existing) {
    throw new Error(`This period was already finalized on ${new Date(existing.finalizedAt).toLocaleDateString()}.`);
  }
  const record: SalaryFinalization = {
    id: docId(input.employeeId, input.period),
    employeeId: input.employeeId,
    period: input.period,
    finalizedAt: new Date().toISOString(),
    snapshot: input.snapshot,
    advanceTransactionId: input.advanceTransactionId,
    paymentId: input.paymentId,
    emailedTo: input.emailedTo,
  };
  await setDoc(finalizationDocRef(input.employeeId, input.period), record);
  return record;
}
