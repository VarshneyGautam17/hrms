import { db, DEFAULT_SETTINGS_ID, createDefaultSettings, ensureDefaultSettings } from '../database';
import type { AppSettings } from '../../types';

/**
 * Read-only: returns the stored settings, or an in-memory default if the
 * settings row hasn't been created yet. Safe to call from `useLiveQuery`
 * (never writes). Use `ensureDefaultSettings` at app bootstrap to persist
 * the default row.
 */
export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(DEFAULT_SETTINGS_ID);
  return existing ?? createDefaultSettings();
}

export async function updateSettings(changes: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
  const current = await ensureDefaultSettings();
  const updated: AppSettings = { ...current, ...changes, updatedAt: new Date().toISOString() };
  await db.settings.put({ ...updated, id: DEFAULT_SETTINGS_ID });
  return updated;
}
