import { useState, type FormEvent } from 'react';
import { giveAdvance, recordRepayment, computeOutstandingBalance, allAdvancesQuery } from '../../db/repositories/advances';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, SummaryCard } from '../../components/ui/Card';
import { formatDisplayDate, todayISO } from '../../utils/dates';
import { formatPaiseAsINR, parseRupeeInputToPaise } from '../../utils/currency';
import type { AdvanceTransaction, AdvanceTransactionType, Employee } from '../../types';

export function AdvancesPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const transactions = useCollection<AdvanceTransaction>(allAdvancesQuery(), []);

  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<AdvanceTransactionType>('ADVANCE');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, `${e.name} (${e.employeeCode})`]));

  const outstandingByEmployee = (employees ?? []).map((e) => {
    const txs = (transactions ?? []).filter((t) => t.employeeId === e.id);
    const totalAdvanced = txs.filter((t) => t.type === 'ADVANCE').reduce((s, t) => s + t.amountPaise, 0);
    const totalRepaid = txs.filter((t) => t.type === 'REPAYMENT').reduce((s, t) => s + t.amountPaise, 0);
    return { employee: e, totalAdvanced, totalRepaid, outstanding: computeOutstandingBalance(txs) };
  });

  const totalOutstanding = outstandingByEmployee.reduce((sum, row) => sum + row.outstanding, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!employeeId) {
      setError('Select an employee.');
      return;
    }
    const amountPaise = parseRupeeInputToPaise(amount);
    if (amountPaise <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    try {
      if (type === 'ADVANCE') {
        await giveAdvance({ employeeId, date, amountPaise, notes: notes.trim() || null });
        setSuccess('Advance entry recorded.');
      } else {
        await recordRepayment({ employeeId, date, amountPaise, notes: notes.trim() || null });
        setSuccess('Repayment entry recorded.');
      }
      setAmount('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record entry.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Advances</h1>
        <p className="text-sm text-slate-500">
          Select an employee and log the advance payment he asked for. The total outstanding advance per employee is
          calculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard label="Total Outstanding (All Employees)" value={formatPaiseAsINR(totalOutstanding)} />
        <SummaryCard label="Employees with Advances" value={outstandingByEmployee.filter((r) => r.totalAdvanced > 0).length} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SelectField label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-56">
          <option value="">Select employee</option>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeCode})
            </option>
          ))}
        </SelectField>
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectField label="Entry Type" value={type} onChange={(e) => setType(e.target.value as AdvanceTransactionType)}>
          <option value="ADVANCE">Advance Given</option>
          <option value="REPAYMENT">Repayment</option>
        </SelectField>
        <TextField label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-48" />
        <Button type="submit">{type === 'ADVANCE' ? 'Add Advance Entry' : 'Add Repayment Entry'}</Button>
        {error && (
          <p className="w-full text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && <p className="w-full text-sm text-green-700">{success}</p>}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Outstanding by Employee</h2>
        {outstandingByEmployee.length === 0 ? (
          <EmptyState title="No active employees yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Employee</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Total Advanced</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Total Repaid</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outstandingByEmployee.map((row) => (
                  <tr key={row.employee.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {row.employee.name} <span className="text-slate-400">({row.employee.employeeCode})</span>
                    </td>
                    <td className="px-4 py-2">{formatPaiseAsINR(row.totalAdvanced)}</td>
                    <td className="px-4 py-2">{formatPaiseAsINR(row.totalRepaid)}</td>
                    <td className="px-4 py-2">
                      {row.outstanding > 0 ? (
                        <Badge tone="warning">{formatPaiseAsINR(row.outstanding)}</Badge>
                      ) : (
                        <Badge tone="success">₹0.00</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">All Advance Entries</h2>
        {!transactions || transactions.length === 0 ? (
          <EmptyState title="No advance entries yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Employee</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2">{formatDisplayDate(tx.date)}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{employeeNameById.get(tx.employeeId) ?? 'Unknown'}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tx.type === 'ADVANCE' ? 'warning' : 'success'}>
                        {tx.type === 'ADVANCE' ? 'Advance Given' : 'Repayment'}
                      </Badge>
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
    </div>
  );
}
