import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { updateSettings, settingsDocRef } from '../../db/repositories/settings';
import { allAttendanceQuery } from '../../db/repositories/attendance';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection, useDocument } from '../../firebase/hooks';
import { signOutUser } from '../../firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/spinner';
import { WEEKDAY_LABELS } from '../../utils/dates';
import type { AppSettings, AttendanceRecord, Employee } from '../../types';

export function SettingsPage() {
  const existing = useDocument<AppSettings>(settingsDocRef(), []);
  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (existing && !form) setForm({ ...existing, adminEmail: existing.adminEmail ?? null });
  }, [existing, form]);

  if (!form) return <PageLoader />;

  async function handleSave() {
    if (!form) return;
    try {
      await updateSettings(form);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings', { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the weekly off day used for attendance and salary for all employees.</p>
        </div>
        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void signOutUser()}>
          Sign Out
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Weekly Off Day</h2>
        <p className="mt-1 text-sm text-muted-foreground">This day is a fixed paid weekly off for every employee.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, idx) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={form.weeklyOffDay === idx ? 'default' : 'secondary'}
              onClick={() => setForm({ ...form, weeklyOffDay: idx })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Admin Email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Finalized salary slips are emailed here. Leave blank to skip emailing.
        </p>
        <div className="mt-3 flex flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor="admin-email">Email Address</Label>
          <Input
            id="admin-email"
            type="email"
            placeholder="admin@example.com"
            value={form.adminEmail ?? ''}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value.trim() || null })}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Salary Divisor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Always the actual number of days in that calendar month (28–31) — not configurable.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Salary is always calculated live from current attendance, advances and these settings — nothing is locked
        in, so changing a rule immediately affects every salary slip.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
      </div>

      <DataSummary />
    </div>
  );
}

function DataSummary() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const attendance = useCollection<AttendanceRecord>(allAttendanceQuery(), []);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Your data is stored in the cloud and synced to every device you sign into.</p>
      <p className="mt-1">
        All {employees?.length ?? 0} employees and {attendance?.length ?? 0} attendance records are stored in your
        Firestore database. Use <strong>Backup &amp; Restore</strong> regularly to export a copy as well.
      </p>
    </div>
  );
}
