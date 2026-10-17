import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  exportBackup,
  downloadBackupFile,
  readBackupFile,
  validateBackup,
  restoreBackup,
  resetAllData,
  type ValidationResult,
} from '../../services/backupService';
import { verifyCurrentPassword } from '../../firebase/auth';
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
import { Spinner } from '@/components/spinner';
import type { BackupFile } from '../../types';

export function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await exportBackup();
      downloadBackupFile(backup);
      toast.success('Backup exported', {
        description: `${backup.data.employees.length} employees, ${backup.data.attendance.length} attendance records.`,
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = await readBackupFile(file);
      const result = validateBackup(raw);
      setValidation(result);
      if (result.valid) {
        setPendingBackup(raw as BackupFile);
        setConfirmOpen(true);
      } else {
        setPendingBackup(null);
        toast.warning('This backup file could not be validated', { description: 'See details below. Existing data was not changed.' });
      }
    } catch {
      setValidation({ valid: false, issues: [{ message: 'The selected file is not valid JSON.' }], recordCounts: {} });
      setPendingBackup(null);
      toast.error('The selected file is not valid JSON.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleConfirmRestore() {
    if (!pendingBackup) return;
    setConfirmOpen(false);
    try {
      await restoreBackup(pendingBackup);
      toast.success('Backup restored', { description: 'Existing data has been replaced.' });
    } catch (err) {
      toast.error('Failed to restore backup', {
        description: err instanceof Error ? err.message : 'Existing data was not changed.',
      });
    } finally {
      setPendingBackup(null);
    }
  }

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
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Backup &amp; Restore</h1>
        <p className="text-sm text-muted-foreground">
          Your data lives only in this browser's IndexedDB storage. Export a backup regularly, and use restore to
          move data to another device manually. There is no automatic sync between devices.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Important</p>
        <p className="mt-1">
          Clearing your browser's site data, losing this device, or storage corruption can permanently delete all
          employee, attendance, advance, and salary records. Export a backup regularly and store it safely.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Export Backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Downloads a single JSON file containing all employees, attendance, advances, payments and settings.
        </p>
        <Button className="mt-3 w-full sm:w-auto" onClick={handleExport} disabled={exporting}>
          {exporting && <Spinner />}
          {exporting ? 'Exporting…' : 'Export Backup (JSON)'}
        </Button>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Restore from Backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Restoring replaces all current data with the contents of the backup file. This cannot be undone — export a
          fresh backup first if you want to keep the current data.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileSelected}
          className="mt-3 block text-sm"
          aria-label="Select backup file to restore"
        />

        {validation && !validation.valid && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">This backup file could not be validated:</p>
            <ul className="mt-1 list-disc pl-5">
              {validation.issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
            <p className="mt-1">Existing data was not changed.</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-card p-4">
        <h2 className="text-sm font-semibold text-destructive">Reset All Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes every employee, attendance, advance, payment and setting from this browser. This
          cannot be undone — export a backup first if you might need this data again.
        </p>
        <Button className="mt-3 w-full sm:w-auto" variant="destructive" onClick={() => setResetConfirmOpen(true)} disabled={resetting}>
          {resetting && <Spinner />}
          {resetting ? 'Resetting…' : 'Reset All Data'}
        </Button>
      </section>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmOpen(false);
            setPendingBackup(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {validation
                ? `This backup contains ${validation.recordCounts.employees ?? 0} employees and ${
                    validation.recordCounts.attendance ?? 0
                  } attendance records. Restoring will replace ALL current data in this browser. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmRestore}>
              Replace Data &amp; Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every employee, attendance, advance, payment and setting from this browser.
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
            <div className="flex flex-col gap-1.5">
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
    </div>
  );
}
