import { useRef, useState, type ChangeEvent } from 'react';
import {
  exportBackup,
  downloadBackupFile,
  readBackupFile,
  validateBackup,
  restoreBackup,
  type ValidationResult,
} from '../../services/backupService';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { BackupFile } from '../../types';

export function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      const backup = await exportBackup();
      downloadBackupFile(backup);
      setExportMessage(
        `Backup exported with ${backup.data.employees.length} employees and ${backup.data.attendance.length} attendance records.`,
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreMessage(null);

    try {
      const raw = await readBackupFile(file);
      const result = validateBackup(raw);
      setValidation(result);
      if (result.valid) {
        setPendingBackup(raw as BackupFile);
        setConfirmOpen(true);
      } else {
        setPendingBackup(null);
      }
    } catch {
      setValidation({ valid: false, issues: [{ message: 'The selected file is not valid JSON.' }], recordCounts: {} });
      setPendingBackup(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleConfirmRestore() {
    if (!pendingBackup) return;
    setConfirmOpen(false);
    try {
      await restoreBackup(pendingBackup);
      setRestoreMessage({ type: 'success', text: 'Backup restored successfully. Existing data has been replaced.' });
    } catch (err) {
      setRestoreMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to restore backup. Existing data was not changed.',
      });
    } finally {
      setPendingBackup(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Backup &amp; Restore</h1>
        <p className="text-sm text-slate-500">
          Your data lives only in this browser's IndexedDB storage. Export a backup regularly, and use restore to
          move data to another device manually. There is no automatic sync between devices.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Important</p>
        <p className="mt-1">
          Clearing your browser's site data, losing this device, or storage corruption can permanently delete all
          employee, attendance, advance, and salary records. Export a backup regularly and store it safely.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Export Backup</h2>
        <p className="mt-1 text-sm text-slate-500">
          Downloads a single JSON file containing all employees, attendance, holidays, leave, advances, payments,
          settlements and settings.
        </p>
        <Button className="mt-3" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export Backup (JSON)'}
        </Button>
        {exportMessage && <p className="mt-2 text-sm text-green-700">{exportMessage}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Restore from Backup</h2>
        <p className="mt-1 text-sm text-slate-500">
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

        {restoreMessage && (
          <p className={`mt-3 text-sm ${restoreMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`} role="status">
            {restoreMessage.text}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Restore backup?"
        description={
          validation
            ? `This backup contains ${validation.recordCounts.employees ?? 0} employees and ${
                validation.recordCounts.attendance ?? 0
              } attendance records. Restoring will replace ALL current data in this browser. This cannot be undone.`
            : ''
        }
        confirmLabel="Replace Data & Restore"
        danger
        onCancel={() => {
          setConfirmOpen(false);
          setPendingBackup(null);
        }}
        onConfirm={handleConfirmRestore}
      />
    </div>
  );
}
