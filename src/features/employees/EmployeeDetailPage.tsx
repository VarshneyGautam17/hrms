import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatPaiseAsINR, parseRupeeInputToPaise } from '../../utils/currency';
import { formatDisplayDate, formatDisplayPeriod, todayISO } from '../../utils/dates';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Card, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { computeOutstandingBalance, giveAdvance, recordRepayment } from '../../db/repositories/advances';
import { setAttendanceStatus } from '../../db/repositories/attendance';
import { AttendanceStatusButtons } from '../attendance/AttendanceStatusButtons';
import { EmployeeAttendanceCalendar } from './EmployeeAttendanceCalendar';
import { toCSV, downloadCSV } from '../../services/csvExport';
import type { AdvanceTransactionType, MarkedAttendanceStatus } from '../../types';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const employee = useLiveQuery(() => (id ? db.employees.get(id) : undefined), [id]);
  const attendance = useLiveQuery(
    () => (id ? db.attendance.where('employeeId').equals(id).reverse().sortBy('date') : []),
    [id],
  );
  const advances = useLiveQuery(
    () => (id ? db.advanceTransactions.where('employeeId').equals(id).sortBy('date') : []),
    [id],
  );
  const settlements = useLiveQuery(
    () => (id ? db.salarySettlements.where('employeeId').equals(id).sortBy('period') : []),
    [id],
  );
  const today = todayISO();
  const todayRecord = useLiveQuery(
    () => (id ? db.attendance.where('[employeeId+date]').equals([id, today]).first() : undefined),
    [id, today],
  );

  if (!id) return null;
  if (employee === undefined) return <p className="text-sm text-slate-500">Loading…</p>;

  const employeeId = id;
  const emp = employee;
  const outstanding = advances ? computeOutstandingBalance(advances) : 0;

  async function handleMarkToday(status: MarkedAttendanceStatus) {
    await setAttendanceStatus(employeeId, today, status);
  }

  function exportAttendanceCSV() {
    const rows = (attendance ?? []).map((a) => ({
      date: a.date,
      status: a.status,
      notes: a.notes ?? '',
    }));
    const csv = toCSV(rows, [
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ]);
    downloadCSV(`attendance-${emp.employeeCode}.csv`, csv);
  }

  function exportAdvanceLedgerCSV() {
    let running = 0;
    const rows = (advances ?? []).map((tx) => {
      running += tx.type === 'ADVANCE' ? tx.amountPaise : -tx.amountPaise;
      return {
        date: tx.date,
        type: tx.type,
        amount: formatPaiseAsINR(tx.amountPaise),
        runningBalance: formatPaiseAsINR(running),
        notes: tx.notes ?? '',
      };
    });
    const csv = toCSV(rows, [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'runningBalance', label: 'Running Balance' },
      { key: 'notes', label: 'Notes' },
    ]);
    downloadCSV(`advance-ledger-${emp.employeeCode}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/employees" className="text-sm text-slate-500 hover:underline">
          ← Back to Employees
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{employee.name}</h1>
        <p className="text-sm text-slate-500">
          {employee.employeeCode} · {employee.department ?? 'No department'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-500">Monthly Salary</p>
          <p className="mt-1 text-lg font-semibold">{formatPaiseAsINR(employee.monthlySalaryPaise)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Joining Date</p>
          <p className="mt-1 text-lg font-semibold">{formatDisplayDate(employee.joiningDate)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Outstanding Advance</p>
          <p className="mt-1 text-lg font-semibold">{formatPaiseAsINR(outstanding)}</p>
        </Card>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Today's Attendance</h2>
        <p className="mt-1 text-xs text-slate-500">{formatDisplayDate(today)}</p>
        <div className="mt-3">
          <AttendanceStatusButtons value={todayRecord?.status ?? null} onChange={handleMarkToday} aria-label="Today's attendance status" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Attendance Calendar (Last 3 Months)</h2>
        <EmployeeAttendanceCalendar employee={employee} />
      </section>

      <AdvanceSection employeeId={id} outstanding={outstanding} transactions={advances ?? []} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Recent Attendance</h2>
          <button className="text-sm text-slate-600 hover:underline" onClick={exportAttendanceCSV}>
            Export CSV
          </button>
        </div>
        {!attendance || attendance.length === 0 ? (
          <EmptyState title="No attendance recorded yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.slice(0, 15).map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2">{formatDisplayDate(a.date)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2 text-slate-500">{a.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Advance Ledger</h2>
          <button className="text-sm text-slate-600 hover:underline" onClick={exportAdvanceLedgerCSV}>
            Export CSV
          </button>
        </div>
        {!advances || advances.length === 0 ? (
          <EmptyState title="No advances recorded" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {advances.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2">{formatDisplayDate(tx.date)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tx.type === 'ADVANCE' ? 'warning' : 'success'}>{tx.type === 'ADVANCE' ? 'Advance Given' : 'Repayment'}</Badge>
                    </td>
                    <td className="px-4 py-2">{formatPaiseAsINR(tx.amountPaise)}</td>
                    <td className="px-4 py-2 text-slate-500">{tx.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">Salary Settlement History</h2>
        <p className="mt-1 text-xs text-slate-500">
          Final salary receipts are generated from the{' '}
          <Link to="/salary" className="underline">
            Salary &amp; Records
          </Link>{' '}
          section.
        </p>
        {!settlements || settlements.length === 0 ? (
          <EmptyState title="No finalized settlements yet" />
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Period</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Payable</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">{formatDisplayPeriod(s.period)}</td>
                    <td className="px-4 py-2">{formatPaiseAsINR(s.payablePaise)}</td>
                    <td className="px-4 py-2">
                      <Badge tone="success">{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AdvanceSection({
  employeeId,
  outstanding,
}: {
  employeeId: string;
  outstanding: number;
  transactions: { id: string; type: AdvanceTransactionType; amountPaise: number }[];
}) {
  const [mode, setMode] = useState<'ADVANCE' | 'REPAYMENT'>('ADVANCE');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amountPaise = parseRupeeInputToPaise(amount);
    if (amountPaise <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    try {
      if (mode === 'ADVANCE') {
        await giveAdvance({ employeeId, date, amountPaise, notes: notes.trim() || null });
        setSuccess('Advance recorded.');
      } else {
        await recordRepayment({ employeeId, date, amountPaise, notes: notes.trim() || null });
        setSuccess('Repayment recorded.');
      }
      setAmount('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record transaction.');
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Advance Payment</h2>
        <p className="text-sm text-slate-500">
          Outstanding balance: <span className="font-semibold text-slate-900">{formatPaiseAsINR(outstanding)}</span>
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('ADVANCE')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'ADVANCE' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Give Advance
        </button>
        <button
          type="button"
          onClick={() => setMode('REPAYMENT')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'REPAYMENT' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Record Repayment
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-56" />
        <Button type="submit">{mode === 'ADVANCE' ? 'Give Advance' : 'Record Repayment'}</Button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && <p className="mt-2 text-sm text-green-700">{success}</p>}
    </section>
  );
}
