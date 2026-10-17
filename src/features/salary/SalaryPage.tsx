import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { computeSalarySlip, type SalarySlip } from '../../services/salaryService';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { formatPaiseAsINR, parseRupeeInputToPaise } from '../../utils/currency';
import { currentPeriod, previousPeriods, formatDisplayPeriod, todayISO, formatDisplayDate } from '../../utils/dates';

export function SalaryPage() {
  const employees = useLiveQuery(() => db.employees.orderBy('name').toArray(), []);
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
      <div className="no-print">
        <h1 className="text-xl font-semibold text-slate-900">Salary &amp; Records</h1>
        <p className="text-sm text-slate-500">Select an employee and a month to see their salary slip and final payable amount.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 no-print">
        <SelectField label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-56">
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeCode})
            </option>
          ))}
        </SelectField>
        <SelectField label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-48">
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatDisplayPeriod(p)}
            </option>
          ))}
        </SelectField>
      </div>

      {!employees || employees.length === 0 ? (
        <p className="text-sm text-slate-500 no-print">No employees yet. Add one from the Employees section.</p>
      ) : employeeId ? (
        <SalarySlipView employeeId={employeeId} period={period} />
      ) : null}
    </div>
  );
}

function SalarySlipView({ employeeId, period }: { employeeId: string; period: string }) {
  const [otherDeduction, setOtherDeduction] = useState('0');
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSlip() {
    setLoading(true);
    try {
      const otherDeductionPaise = parseRupeeInputToPaise(otherDeduction);
      const result = await computeSalarySlip(employeeId, period, otherDeductionPaise);
      setSlip(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOtherDeduction('0');
  }, [employeeId, period]);

  useEffect(() => {
    loadSlip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, period, otherDeduction]);

  if (!slip) return <p className="text-sm text-slate-500 no-print">Loading…</p>;

  const s = slip.snapshot;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 no-print">
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
      </div>

      <div className="print-area mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-200 pb-3 text-center">
          <p className="text-lg font-semibold text-slate-900">Salary Slip</p>
          <p className="text-sm text-slate-500">{formatDisplayPeriod(period)}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Employee Name</dt>
          <dd className="text-right font-medium text-slate-900">{slip.employee.name}</dd>
          <dt className="text-slate-500">Employee Code</dt>
          <dd className="text-right text-slate-900">{slip.employee.employeeCode}</dd>
          <dt className="text-slate-500">Department</dt>
          <dd className="text-right text-slate-900">{slip.employee.department ?? '—'}</dd>
          <dt className="text-slate-500">Attendance</dt>
          <dd className="text-right text-slate-900">
            {s.presentDays} Present · {s.halfDays} Half Day · {s.unpaidAbsentDays} Absent · {s.notMarkedDays} Not Marked ·{' '}
            {s.paidWeeklyOffDays} Weekly Off
          </dd>
        </dl>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <Row label="Monthly Salary" value={formatPaiseAsINR(s.monthlySalaryPaise)} />
            <Row label="Attendance Deduction" value={`− ${formatPaiseAsINR(s.attendanceDeductionPaise)}`} />
            <Row label="Other Deduction" value={`− ${formatPaiseAsINR(s.otherDeductionPaise)}`} />
            <Row label="Earned Salary" value={formatPaiseAsINR(s.earnedSalaryPaise)} strong />
            <Row label="Already Paid" value={`− ${formatPaiseAsINR(s.alreadyPaidPaise)}`} />
            <Row label="Outstanding Advance" value={formatPaiseAsINR(s.outstandingAdvanceBeforePaise)} />
            <Row label="Advance Recovered" value={`− ${formatPaiseAsINR(s.advanceRecoveredPaise)}`} />
            <Row label="Advance Carried Forward" value={formatPaiseAsINR(s.advanceCarriedForwardPaise)} />
          </dl>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
          <span className="text-sm font-semibold text-slate-700">Final Payable</span>
          <span className="text-lg font-bold text-green-700">{formatPaiseAsINR(s.finalPayablePaise)}</span>
        </div>

        <div className="mt-4 text-right text-xs text-slate-400">
          <span>Generated on {formatDisplayDate(todayISO())}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <Button onClick={() => window.print()} disabled={loading}>
          Print Salary Slip
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className={`text-slate-500 ${strong ? 'font-medium text-slate-700' : ''}`}>{label}</dt>
      <dd className={`text-right ${strong ? 'font-semibold text-slate-900' : 'text-slate-900'}`}>{value}</dd>
    </>
  );
}
