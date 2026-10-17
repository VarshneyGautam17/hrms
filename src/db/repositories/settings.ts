import { getDoc, setDoc } from 'firebase/firestore';
import { userDoc } from '../../firebase/paths';
import type { AppSettings } from '../../types';

const COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'default';

export function settingsDocRef() {
  return userDoc(COLLECTION, SETTINGS_DOC_ID);
}

export function createDefaultSettings(): AppSettings {
  return {
    id: SETTINGS_DOC_ID,
    weeklyOffDay: 1, // Monday
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Read-only: returns the stored settings, or an in-memory default if the
 * settings doc hasn't been created yet. Safe to call from a live subscriber
 * (never writes).
 */
export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(userDoc(COLLECTION, SETTINGS_DOC_ID));
  return snap.exists() ? (snap.data() as AppSettings) : createDefaultSettings();
}

/** Creates the default settings doc if one doesn't exist yet. */
export async function ensureDefaultSettings(): Promise<AppSettings> {
  const snap = await getDoc(userDoc(COLLECTION, SETTINGS_DOC_ID));
  if (snap.exists()) return snap.data() as AppSettings;
  const defaults = createDefaultSettings();
  await setDoc(userDoc(COLLECTION, SETTINGS_DOC_ID), defaults);
  return defaults;
}

export async function updateSettings(changes: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
  const current = await ensureDefaultSettings();
  const updated: AppSettings = { ...current, ...changes, updatedAt: new Date().toISOString() };
  await setDoc(userDoc(COLLECTION, SETTINGS_DOC_ID), updated);
  return updated;
}
