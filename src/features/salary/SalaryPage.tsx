import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { previewSettlement, finalizeSettlement, type SettlementPreview } from '../../services/settlementService';
import { toCSV, downloadCSV } from '../../services/csvExport';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatPaiseAsINR, parseRupeeInputToPaise, paiseToRupees } from '../../utils/currency';
import { currentPeriod, previousPeriods, formatDisplayPeriod, daysInPeriod } from '../../utils/dates';
import type { Employee } from '../../types';

export function SalaryPage() {
  const employees = useLiveQuery(() => db.employees.where('status').equals('ACTIVE').sortBy('name'), []);
  const [period, setPeriod] = useState(currentPeriod());
  const [employeeId, setEmployeeId] = useState('');

  const periods = [currentPeriod(), ...previousPeriods(12).slice(1)];

  useEffect(() => {
    if (!employeeId && employees && employees.length > 0) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Salary &amp; Records</h1>
        <p className="text-sm text-slate-500">
          See every employee's salary for a month, export the company records, and finalize individual settlements.
        </p>
      </div>

      <SelectField label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-48">
        {periods.map((p) => (
          <option key={p} value={p}>
            {formatDisplayPeriod(p)}
          </option>
        ))}
      </SelectField>

      <AllEmployeesTable employees={employees ?? []} period={period} onSelect={setEmployeeId} selectedId={employeeId} />

      <ExportActions employees={employees ?? []} period={period} />

      {employeeId && <EmployeeSettlementPanel employeeId={employeeId} period={period} />}
    </div>
  );
}

function AllEmployeesTable({
  employees,
  period,
  onSelect,
  selectedId,
}: {
  employees: Employee[];
  period: string;
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  const [previews, setPreviews] = useState<Record<string, SettlementPreview>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(employees.map((e) => previewSettlement(e.id, period).then((p) => [e.id, p] as const)))
      .then((entries) => {
        if (cancelled) return;
        setPreviews(Object.fromEntries(entries));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employees, period]);

  if (employees.length === 0) return <p className="text-sm text-slate-500">No active employees yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Employee</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Present</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Half Day</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Absent</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Outstanding Advance</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Payable</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((e) => {
            const p = previews[e.id];
            return (
              <tr key={e.id} className={selectedId === e.id ? 'bg-slate-50' : undefined}>
                <td className="px-4 py-2 font-medium text-slate-900">
                  {e.name} <span className="text-slate-400">({e.employeeCode})</span>
                </td>
                <td className="px-4 py-2">{p?.snapshot.presentDays ?? (loading ? '…' : '—')}</td>
                <td className="px-4 py-2">{p?.snapshot.halfDays ?? (loading ? '…' : '—')}</td>
                <td className="px-4 py-2">{p?.snapshot.unpaidAbsentDays ?? (loading ? '…' : '—')}</td>
                <td className="px-4 py-2">{p ? formatPaiseAsINR(p.snapshot.outstandingAdvanceBeforePaise) : '—'}</td>
                <td className="px-4 py-2">{p ? formatPaiseAsINR(p.snapshot.finalPayablePaise) : '—'}</td>
                <td className="px-4 py-2">
                  {p?.alreadyFinalized ? <Badge tone="success">Finalized</Badge> : <Badge>Draft</Badge>}
                </td>
                <td className="px-4 py-2">
                  <button className="text-sm font-medium text-slate-700 hover:underline" onClick={() => onSelect(e.id)}>
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExportActions({ employees, period }: { employees: Employee[]; period: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function exportCompanyAttendance() {
    setBusy('attendance');
    try {
      const days = daysInPeriod(period);
      const attendance = await db.attendance.where('date').between(days[0], days[days.length - 1], true, true).toArray();
      const nameById = new Map(employees.map((e) => [e.id, `${e.name} (${e.employeeCode})`]));
      const rows = attendance.map((a) => ({
        employee: nameById.get(a.employeeId) ?? a.employeeId,
        date: a.date,
        status: a.status,
        notes: a.notes ?? '',
      }));
      const csv = toCSV(rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
      ]);
      downloadCSV(`company-attendance-${period}.csv`, csv);
    } finally {
      setBusy(null);
    }
  }

  async function exportSalaryStatement() {
    setBusy('salary');
    try {
      const rows = [];
      for (const emp of employees) {
        const preview = await previewSettlement(emp.id, period);
        rows.push({
          employee: `${emp.name} (${emp.employeeCode})`,
          monthlySalary: paiseToRupees(preview.snapshot.monthlySalaryPaise).toFixed(2),
          present: preview.snapshot.presentDays,
          halfDays: preview.snapshot.halfDays,
          absent: preview.snapshot.unpaidAbsentDays,
          attendanceDeduction: paiseToRupees(preview.snapshot.attendanceDeductionPaise).toFixed(2),
          advanceRecovered: paiseToRupees(preview.snapshot.advanceRecoveredPaise).toFixed(2),
          finalPayable: paiseToRupees(preview.snapshot.finalPayablePaise).toFixed(2),
        });
      }
      const csv = toCSV(rows, [
        { key: 'employee', label: 'Employee' },
        { key: 'monthlySalary', label: 'Monthly Salary (INR)' },
        { key: 'present', label: 'Present Days' },
        { key: 'halfDays', label: 'Half Days' },
        { key: 'absent', label: 'Absent Days' },
        { key: 'attendanceDeduction', label: 'Attendance Deduction (INR)' },
        { key: 'advanceRecovered', label: 'Advance Recovered (INR)' },
        { key: 'finalPayable', label: 'Final Payable (INR)' },
      ]);
      downloadCSV(`salary-statement-${period}.csv`, csv);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={exportCompanyAttendance} disabled={busy === 'attendance'}>
        Export Company Attendance (CSV)
      </Button>
      <Button variant="secondary" onClick={exportSalaryStatement} disabled={busy === 'salary'}>
        Export Salary Statement (CSV)
      </Button>
      <Button variant="ghost" onClick={() => window.print()}>
        Print
      </Button>
    </Card>
  );
}

function EmployeeSettlementPanel({ employeeId, period }: { employeeId: string; period: string }) {
  const [otherDeduction, setOtherDeduction] = useState('0');
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadPreview() {
    setLoading(true);
    setMessage(null);
    try {
      const otherDeductionPaise = parseRupeeInputToPaise(otherDeduction);
      const result = await previewSettlement(employeeId, period, otherDeductionPaise);
      setPreview(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, period]);

  async function handleFinalize() {
    setConfirmOpen(false);
    setLoading(true);
    setMessage(null);
    try {
      const otherDeductionPaise = parseRupeeInputToPaise(otherDeduction);
      await finalizeSettlement(employeeId, period, otherDeductionPaise);
      setMessage({ type: 'success', text: 'Salary settlement finalized successfully.' });
      await loadPreview();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to finalize settlement.' });
    } finally {
      setLoading(false);
    }
  }

  if (!preview) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {preview.employee.name} — {formatDisplayPeriod(period)}
        </h2>
        {preview.alreadyFinalized && <Badge tone="success">Finalized</Badge>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Other Deduction (₹)"
          type="number"
          min="0"
          step="0.01"
          value={otherDeduction}
          onChange={(e) => setOtherDeduction(e.target.value)}
          className="w-40"
          hint="Manual, authorized deduction for this period"
        />
        <Button onClick={loadPreview} variant="secondary" disabled={loading}>
          Recalculate
        </Button>
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`} role="status">
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <p className="text-xs uppercase text-slate-500">Present</p>
          <p className="text-lg font-semibold">{preview.snapshot.presentDays}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Half Day</p>
          <p className="text-lg font-semibold">{preview.snapshot.halfDays}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Absent</p>
          <p className="text-lg font-semibold">{preview.snapshot.unpaidAbsentDays}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Paid Holidays</p>
          <p className="text-lg font-semibold">{preview.snapshot.paidHolidayDays}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Paid Weekly Offs</p>
          <p className="text-lg font-semibold">{preview.snapshot.paidWeeklyOffDays}</p>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Salary Calculation</h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Monthly Salary" value={formatPaiseAsINR(preview.snapshot.monthlySalaryPaise)} />
          <Row label="Daily Rate" value={formatPaiseAsINR(preview.snapshot.dailyRatePaise)} />
          <Row label="Unpaid-Day Equivalents" value={String(preview.snapshot.unpaidDayEquivalents)} />
          <Row label="Attendance Deduction" value={`− ${formatPaiseAsINR(preview.snapshot.attendanceDeductionPaise)}`} />
          <Row label="Other Deduction" value={`− ${formatPaiseAsINR(preview.snapshot.otherDeductionPaise)}`} />
          <Row label="Earned Salary" value={formatPaiseAsINR(preview.snapshot.earnedSalaryPaise)} strong />
          <Row label="Already Paid" value={`− ${formatPaiseAsINR(preview.snapshot.alreadyPaidPaise)}`} />
          <Row label="Available for Advance Recovery" value={formatPaiseAsINR(preview.snapshot.availableForRecoveryPaise)} />
          <Row label="Outstanding Advance (before)" value={formatPaiseAsINR(preview.snapshot.outstandingAdvanceBeforePaise)} />
          <Row label="Advance Recovered" value={`− ${formatPaiseAsINR(preview.snapshot.advanceRecoveredPaise)}`} />
          <Row label="Advance Carried Forward" value={formatPaiseAsINR(preview.snapshot.advanceCarriedForwardPaise)} />
          <Row label="Final Payable" value={formatPaiseAsINR(preview.snapshot.finalPayablePaise)} strong highlight />
        </dl>
      </div>

      <div>
        <Button onClick={() => setConfirmOpen(true)} disabled={loading || preview.alreadyFinalized}>
          {preview.alreadyFinalized ? 'Already Finalized' : 'Finalize Settlement'}
        </Button>
        <p className="mt-2 text-xs text-slate-500">
          Finalizing records an advance recovery transaction (if any) and locks in this calculation as the official
          salary receipt for the period. It will not run twice for the same employee and period.
        </p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Finalize salary settlement"
        description={`This will finalize the salary for ${formatDisplayPeriod(period)} and record any advance recovery. This cannot be undone.`}
        confirmLabel="Finalize"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleFinalize}
      />
    </div>
  );
}

function Row({ label, value, strong, highlight }: { label: string; value: string; strong?: boolean; highlight?: boolean }) {
  return (
    <>
      <dt className={`text-slate-500 ${strong ? 'font-medium text-slate-700' : ''}`}>{label}</dt>
      <dd className={`text-right sm:text-left ${strong ? 'font-semibold' : ''} ${highlight ? 'text-green-700' : 'text-slate-900'}`}>
        {value}
      </dd>
    </>
  );
}
