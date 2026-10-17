export interface FakeUser {
  uid: string;
  email: string | null;
}

let currentUser: FakeUser | null = { uid: 'test-user', email: 'test@example.com' };
const listeners = new Set<(u: FakeUser | null) => void>();

function notify() {
  listeners.forEach((cb) => cb(currentUser));
}

export function getAuth(_app?: unknown) {
  return {};
}

export function onAuthStateChanged(_auth: unknown, callback: (u: FakeUser | null) => void) {
  listeners.add(callback);
  queueMicrotask(() => callback(currentUser));
  return () => listeners.delete(callback);
}

export async function signInWithEmailAndPassword(_auth: unknown, email: string) {
  currentUser = { uid: 'test-user', email };
  notify();
  return { user: currentUser };
}

export async function createUserWithEmailAndPassword(_auth: unknown, email: string) {
  currentUser = { uid: 'test-user', email };
  notify();
  return { user: currentUser };
}

export async function signOut(_auth: unknown) {
  currentUser = null;
  notify();
}

/** Test-only helper to reset the fake signed-in user between tests. */
export function __setFakeUser(user: FakeUser | null) {
  currentUser = user;
  notify();
}
