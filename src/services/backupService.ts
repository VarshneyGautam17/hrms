import { getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { userCollection, userDoc } from '../firebase/paths';
import { firestore } from '../firebase/config';
import { createDefaultSettings } from '../db/repositories/settings';

const COLLECTIONS = ['employees', 'attendance', 'advanceTransactions', 'salaryPayments', 'salaryFinalizations'] as const;

async function deleteAllInCollection(name: string): Promise<void> {
  const snap = await getDocs(userCollection(name));
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(firestore);
    for (const id of ids.slice(i, i + 450)) {
      batch.delete(userDoc(name, id));
    }
    await batch.commit();
  }
}

/**
 * Permanently wipes every employee, attendance, advance, payment and
 * settings record for the signed-in user, then re-seeds the default
 * settings doc. There is no undo — download the History PDFs first if the data might
 * still be needed.
 */
export async function resetAllData(): Promise<void> {
  for (const name of COLLECTIONS) {
    await deleteAllInCollection(name);
  }
  await setDoc(userDoc('settings', 'default'), createDefaultSettings());
}
