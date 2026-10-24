import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { updateSettings, settingsDocRef } from '../../db/repositories/settings';
import { allAttendanceQuery } from '../../db/repositories/attendance';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection, useDocument } from '../../firebase/hooks';
import { signOutUser, verifyCurrentPassword } from '../../firebase/auth';
import { resetAllData } from '../../services/backupService';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader, Spinner } from '@/components/spinner';
import { PasswordConfirmDialog } from '@/components/password-confirm-dialog';
import { WEEKDAY_LABELS } from '../../utils/dates';
import type { AppSettings, AttendanceRecord, Employee } from '../../types';

export function SettingsPage() {
  const existing = useDocument<AppSettings>(settingsDocRef(), []);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  useEffect(() => {
    if (existing && !form) setForm(existing);
  }, [existing, form]);

  if (!form) return <PageLoader />;

  const changed = !!existing && existing.weeklyOffDay !== form.weeklyOffDay;

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
        <h2 className="text-lg font-semibold">Weekly Off Day</h2>
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
        <h2 className="text-lg font-semibold">Salary Divisor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Always the actual number of days in that calendar month (28–31) — not configurable.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Salary is always calculated live from current attendance, advances and these settings — nothing is locked
        in, so changing a rule immediately affects every salary slip.
      </p>

      <div className="flex items-center gap-3">
        <Button onClick={() => setConfirmSaveOpen(true)} disabled={!changed}>
          Save Settings
        </Button>
        {changed && (
          <Button variant="ghost" onClick={() => existing && setForm(existing)}>
            Discard Changes
          </Button>
        )}
      </div>

      <PasswordConfirmDialog
        open={confirmSaveOpen}
        onOpenChange={setConfirmSaveOpen}
        description="Re-enter your account password to change settings. This affects every employee's attendance and salary."
        confirmLabel="Confirm & Save"
        onConfirmed={handleSave}
      />

      <DataSummary />
      <DataManagement />
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
        Firestore database. Monthly records can be downloaded as a PDF from the <strong>History</strong> page.
      </p>
    </div>
  );
}

function DataManagement() {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function openPasswordStep() {
    setResetConfirmOpen(false);
    setPassword('');
    setPasswordError(null);
    setPasswordDialogOpen(true);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setVerifyingPassword(true);
    try {
      await verifyCurrentPassword(password);
    } catch {
      setVerifyingPassword(false);
      setPasswordError('Incorrect password. Try again.');
      return;
    }
    setPasswordDialogOpen(false);
    setPassword('');
    setVerifyingPassword(false);

    setResetting(true);
    try {
      await resetAllData();
      toast.success('All data has been reset', { description: 'The app is now empty, as if freshly installed.' });
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-red-200 bg-card p-4">
        <h2 className="text-lg font-semibold text-destructive">Reset All Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes every employee, attendance, advance, payment and setting from this account. This
          cannot be undone — download the History PDFs first if you might need this data again.
        </p>
        <Button className="mt-3 w-full sm:w-auto" variant="destructive" onClick={() => setResetConfirmOpen(true)} disabled={resetting}>
          {resetting && <Spinner />}
          {resetting ? 'Resetting…' : 'Reset All Data'}
        </Button>
      </div>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every employee, attendance, advance, payment and setting from this account.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={openPasswordStep}>
              Reset All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(next) => {
          setPasswordDialogOpen(next);
          if (!next) {
            setPassword('');
            setPasswordError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>For your safety, re-enter your account password to permanently reset all data.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="reset-password">Password</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {passwordError && (
                <p className="text-sm text-destructive" role="alert">
                  {passwordError}
                </p>
              )}
            </div>
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={verifyingPassword}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={verifyingPassword || !password}>
                {verifyingPassword && <Spinner />}
                Confirm &amp; Reset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
