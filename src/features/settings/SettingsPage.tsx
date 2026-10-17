import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/repositories/settings';
import { db } from '../../db/database';
import { Button } from '../../components/ui/Button';
import { TextField, SelectField } from '../../components/ui/Field';
import type { AppSettings, SalaryDivisorMode } from '../../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsPage() {
  const existing = useLiveQuery(() => getSettings(), []);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing && !form) setForm(existing);
  }, [existing, form]);

  if (!form) return <p className="text-sm text-slate-500">Loading…</p>;

  function toggleWeeklyOff(day: number) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.weeklyOffDays.includes(day);
      return {
        ...prev,
        weeklyOffDays: has ? prev.weeklyOffDays.filter((d) => d !== day) : [...prev.weeklyOffDays, day].sort(),
      };
    });
  }

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
        <p className="text-sm text-slate-500">Configure how salary is calculated for all employees.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Salary Divisor</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Divisor Mode"
            value={form.salaryDivisorMode}
            onChange={(e) => setForm({ ...form, salaryDivisorMode: e.target.value as SalaryDivisorMode })}
          >
            <option value="FIXED">Fixed divisor</option>
            <option value="CALENDAR_DAYS">Calendar days in month</option>
          </SelectField>
          {form.salaryDivisorMode === 'FIXED' && (
            <TextField
              label="Fixed Divisor"
              type="number"
              min="1"
              value={form.fixedDivisor}
              onChange={(e) => setForm({ ...form, fixedDivisor: Number(e.target.value) })}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Weekly Off Days</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAYS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleWeeklyOff(idx)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                form.weeklyOffDays.includes(idx)
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Changing these rules does not rewrite already-finalized salary settlements — each settlement stores a
        snapshot of the figures used to calculate it at the time.
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
    settlements: await db.salarySettlements.count(),
  }));

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Your data lives in this browser only.</p>
      <p className="mt-1">
        All {counts?.employees ?? 0} employees, {counts?.attendance ?? 0} attendance records and{' '}
        {counts?.settlements ?? 0} finalized settlements are stored locally in this browser's IndexedDB. Clearing
        browser data, losing this device, or storage corruption can permanently delete this data. Use{' '}
        <strong>Backup &amp; Restore</strong> regularly to export a copy.
      </p>
    </div>
  );
}
