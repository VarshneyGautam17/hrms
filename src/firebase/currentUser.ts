import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './config';

let currentUser: User | null = null;

onAuthStateChanged(auth, (u) => {
  currentUser = u;
});

/** Throws if nobody is signed in. Every repository call happens after the app's auth gate, so this should never fire in practice. */
export function requireUid(): string {
  if (!currentUser) throw new Error('You must be signed in.');
  return currentUser.uid;
}

export function getCurrentUid(): string | null {
  return currentUser?.uid ?? null;
}
