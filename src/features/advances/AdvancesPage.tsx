import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Users, Wallet } from 'lucide-react';
import { giveAdvance, recordRepayment, computeOutstandingBalance, allAdvancesQuery } from '../../db/repositories/advances';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToneBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/summary-card';
import { DatePicker } from '@/components/date-picker';
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
    if (!employeeId) {
      toast.warning('Select an employee first.');
      return;
    }
    const amountPaise = parseRupeeInputToPaise(amount);
    if (amountPaise <= 0) {
      toast.warning('Amount must be greater than zero.');
      return;
    }
    try {
      if (type === 'ADVANCE') {
        await giveAdvance({ employeeId, date, amountPaise, notes: notes.trim() || null });
        toast.success('Advance entry recorded.');
      } else {
        await recordRepayment({ employeeId, date, amountPaise, notes: notes.trim() || null });
        toast.success('Repayment entry recorded.');
      }
      setAmount('');
      setNotes('');
    } catch (err) {
      toast.error('Failed to record entry', { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Advances</h1>
        <p className="text-sm text-muted-foreground">
          Select an employee and log the advance payment he asked for. The total outstanding advance per employee is
          calculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Total Outstanding (All Employees)"
          value={formatPaiseAsINR(totalOutstanding)}
          icon={Wallet}
          tone="warning"
        />
        <SummaryCard
          label="Employees with Advances"
          value={outstandingByEmployee.filter((r) => r.totalAdvanced > 0).length}
          icon={Users}
          tone="info"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:items-end lg:grid-cols-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees?.map((e) => (
                <SelectItem key={e.id} value={e.id} label={`${e.name} (${e.employeeCode})`}>
                  {e.name} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="advance-date">Date</Label>
          <DatePicker id="advance-date" value={date} onChange={setDate} disabled={(d) => d > new Date()} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Entry Type</Label>
          <Select value={type} onValueChange={(v) => v && setType(v as AdvanceTransactionType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADVANCE" label="Advance Given">Advance Given</SelectItem>
              <SelectItem value="REPAYMENT" label="Repayment">Repayment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="advance-amount">Amount (₹)</Label>
          <Input id="advance-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="advance-notes">Notes (optional)</Label>
          <Input id="advance-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="sm:col-span-2 lg:col-span-5 lg:w-fit">
          {type === 'ADVANCE' ? 'Add Advance Entry' : 'Add Repayment Entry'}
        </Button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Outstanding by Employee</h2>
        {outstandingByEmployee.length === 0 ? (
          <EmptyState icon={Users} title="No active employees yet" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Employee</TableHead>
                  <TableHead>Total Advanced</TableHead>
                  <TableHead>Total Repaid</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingByEmployee.map((row) => (
                  <TableRow key={row.employee.id}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {row.employee.name} <span className="text-muted-foreground">({row.employee.employeeCode})</span>
                    </TableCell>
                    <TableCell>{formatPaiseAsINR(row.totalAdvanced)}</TableCell>
                    <TableCell>{formatPaiseAsINR(row.totalRepaid)}</TableCell>
                    <TableCell>
                      {row.outstanding > 0 ? (
                        <ToneBadge tone="warning">{formatPaiseAsINR(row.outstanding)}</ToneBadge>
                      ) : (
                        <ToneBadge tone="success">₹0.00</ToneBadge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">All Advance Entries</h2>
        {!transactions || transactions.length === 0 ? (
          <EmptyState icon={Wallet} title="No advance entries yet" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(tx.date)}</TableCell>
                    <TableCell className="font-medium">{employeeNameById.get(tx.employeeId) ?? 'Unknown'}</TableCell>
                    <TableCell>
                      <ToneBadge tone={tx.type === 'ADVANCE' ? 'warning' : 'success'}>
                        {tx.type === 'ADVANCE' ? 'Advance Given' : 'Repayment'}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>{formatPaiseAsINR(tx.amountPaise)}</TableCell>
                    <TableCell className="text-muted-foreground">{tx.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
