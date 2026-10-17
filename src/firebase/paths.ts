import { collection, doc, type CollectionReference, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { firestore } from './config';
import { requireUid } from './currentUser';

/** Every collection lives under users/{uid}/... so each signed-in user only ever sees their own data. */
export function userCollection(name: string): CollectionReference<DocumentData> {
  return collection(firestore, 'users', requireUid(), name);
}

export function userDoc(name: string, id: string): DocumentReference<DocumentData> {
  return doc(userCollection(name), id);
}
