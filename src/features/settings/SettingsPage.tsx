import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/repositories/settings';
import { db } from '../../db/database';
import { Button } from '../../components/ui/Button';
import { WEEKDAY_LABELS } from '../../utils/dates';
import type { AppSettings } from '../../types';

export function SettingsPage() {
  const existing = useLiveQuery(() => getSettings(), []);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing && !form) setForm(existing);
  }, [existing, form]);

  if (!form) return <p className="text-sm text-slate-500">Loading…</p>;

  async function handleSave() {
    if (!form) return;
    await updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Configure the weekly off day used for attendance and salary for all employees.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Weekly Off Day</h2>
        <p className="mt-1 text-sm text-slate-500">This day is a fixed paid weekly off for every employee.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setForm({ ...form, weeklyOffDay: idx })}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                form.weeklyOffDay === idx
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Salary Divisor</h2>
        <p className="mt-1 text-sm text-slate-500">
          Always the actual number of days in that calendar month (28–31) — not configurable.
        </p>
      </div>

      <p className="text-xs text-slate-500">
        Salary is always calculated live from current attendance, advances and these settings — nothing is locked
        in, so changing a rule immediately affects every salary slip.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>

      <DataSummary />
    </div>
  );
}

function DataSummary() {
  const counts = useLiveQuery(async () => ({
    employees: await db.employees.count(),
    attendance: await db.attendance.count(),
  }));

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Your data lives in this browser only.</p>
      <p className="mt-1">
        All {counts?.employees ?? 0} employees and {counts?.attendance ?? 0} attendance records are stored locally
        in this browser's IndexedDB. Clearing browser data, losing this device, or storage corruption can
        permanently delete this data. Use <strong>Backup &amp; Restore</strong> regularly to export a copy.
      </p>
    </div>
  );
}
