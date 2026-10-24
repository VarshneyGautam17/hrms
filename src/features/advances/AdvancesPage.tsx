import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, HandCoins, Users, Wallet } from 'lucide-react';
import { giveAdvance, recordRepayment, computeOutstandingBalance, allAdvancesQuery } from '../../db/repositories/advances';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToneBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/summary-card';
import { DatePicker } from '@/components/date-picker';
import { formatDisplayDate, todayISO } from '../../utils/dates';
import { formatPaiseAsINR, parseRupeeInputToPaise } from '../../utils/currency';
import { cn } from '@/lib/utils';
import type { AdvanceTransaction, AdvanceTransactionType, Employee } from '../../types';

export function AdvancesPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const transactions = useCollection<AdvanceTransaction>(allAdvancesQuery(), []);

  const [employeeId, setEmployeeId] = useState('');
  // Empty until an employee is chosen, since the allowed dates depend on their joining date.
  const [date, setDate] = useState('');
  const [type, setType] = useState<AdvanceTransactionType>('ADVANCE');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [entryFilter, setEntryFilter] = useState('ALL');
  const [dateSortDir, setDateSortDir] = useState<'asc' | 'desc'>('desc');

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, `${e.name} (${e.employeeCode})`]));
  // Passed to <Select items> so the trigger shows the label, not the raw value (an employee id / "ADVANCE").
  const employeeItems = [...employeeNameById].map(([value, label]) => ({ value, label }));
  const entryTypeItems = [
    { value: 'ADVANCE', label: 'Advance Given' },
    { value: 'REPAYMENT', label: 'Advance Returned' },
  ];
  const entryFilterItems = [{ value: 'ALL', label: 'All Employees' }, ...employeeItems];

  const outstandingByEmployee = (employees ?? []).map((e) => {
    const txs = (transactions ?? []).filter((t) => t.employeeId === e.id);
    const totalAdvanced = txs.filter((t) => t.type === 'ADVANCE').reduce((s, t) => s + t.amountPaise, 0);
    const totalRepaid = txs.filter((t) => t.type === 'REPAYMENT').reduce((s, t) => s + t.amountPaise, 0);
    return { employee: e, totalAdvanced, totalRepaid, outstanding: computeOutstandingBalance(txs) };
  });

  const totalOutstanding = outstandingByEmployee.reduce((sum, row) => sum + row.outstanding, 0);
  const totalAdvanced = outstandingByEmployee.reduce((sum, row) => sum + row.totalAdvanced, 0);
  const totalRepaid = outstandingByEmployee.reduce((sum, row) => sum + row.totalRepaid, 0);

  const filteredTransactions = (
    entryFilter === 'ALL' ? (transactions ?? []) : (transactions ?? []).filter((t) => t.employeeId === entryFilter)
  )
    .slice()
    .sort((a, b) => (dateSortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const selectedEmployee = (employees ?? []).find((e) => e.id === employeeId);
  const joinedInFuture = !!selectedEmployee && selectedEmployee.joiningDate > todayISO();

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    const emp = (employees ?? []).find((e) => e.id === id);
    // Keep the date within the new employee's joining date → today.
    if (!emp) setDate('');
    else if (emp.joiningDate > todayISO()) setDate('');
    else if (!date || date < emp.joiningDate) setDate(todayISO());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) {
      toast.warning('Select an employee first.');
      return;
    }
    if (joinedInFuture) {
      toast.warning(`${selectedEmployee.name} joins on ${formatDisplayDate(selectedEmployee.joiningDate)}. Entries can be added from that day.`);
      return;
    }
    if (!date) {
      toast.warning('Pick a date.');
      return;
    }
    if (date < selectedEmployee.joiningDate) {
      toast.warning(`Date cannot be before ${selectedEmployee.name}'s joining date (${formatDisplayDate(selectedEmployee.joiningDate)}).`);
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
        toast.success('Returned amount recorded.');
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
          Select an employee and log the advance payment he asked for. The advance still pending (not yet returned) per employee is
          calculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Advance Given" value={formatPaiseAsINR(totalAdvanced)} icon={HandCoins} tone="info" />
        <SummaryCard
          label="Total Advance Pending (All Employees)"
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
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Employee</Label>
          <Select items={employeeItems} value={employeeId} onValueChange={(v) => handleEmployeeChange(v ?? '')}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employeeItems.map((item) => (
                <SelectItem key={item.value} value={item.value} label={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="advance-date">Date</Label>
            {selectedEmployee && (
              <span className={cn('truncate text-xs', joinedInFuture ? 'text-amber-700' : 'text-muted-foreground')}>
                {joinedInFuture ? 'Joins' : 'Joined'} {formatDisplayDate(selectedEmployee.joiningDate)}
              </span>
            )}
          </div>
          <DatePicker
            id="advance-date"
            value={date}
            onChange={setDate}
            minDate={selectedEmployee?.joiningDate}
            disabled={(d) => d > new Date()}
            triggerDisabled={!selectedEmployee || joinedInFuture}
            placeholder={selectedEmployee ? 'Pick a date' : 'Select employee first'}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label>Entry Type</Label>
          <Select items={entryTypeItems} value={type} onValueChange={(v) => v && setType(v as AdvanceTransactionType)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entryTypeItems.map((item) => (
                <SelectItem key={item.value} value={item.value} label={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="advance-amount">Amount (₹)</Label>
          <Input id="advance-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="advance-notes">Notes (optional)</Label>
          <Input id="advance-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="sm:col-span-2 lg:col-span-5 lg:w-fit">
          {type === 'ADVANCE' ? 'Add Advance Entry' : 'Add Returned Entry'}
        </Button>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Pending Advance by Employee</h2>
        {outstandingByEmployee.length === 0 ? (
          <EmptyState icon={Users} title="No active employees yet" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Employee</TableHead>
                  <TableHead>Total Advanced</TableHead>
                  <TableHead>Total Returned</TableHead>
                  <TableHead>Pending</TableHead>
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
              <TableFooter>
                <TableRow>
                  <TableCell className="sticky left-0 bg-muted font-semibold">Total</TableCell>
                  <TableCell className="font-semibold">{formatPaiseAsINR(totalAdvanced)}</TableCell>
                  <TableCell className="font-semibold">{formatPaiseAsINR(totalRepaid)}</TableCell>
                  <TableCell className="font-semibold">{formatPaiseAsINR(totalOutstanding)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Advance Entries</h2>
          <Select items={entryFilterItems} value={entryFilter} onValueChange={(v) => setEntryFilter(v ?? 'ALL')}>
            <SelectTrigger className="w-full min-w-0 sm:w-64" aria-label="Filter entries by employee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entryFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value} label={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={entryFilter === 'ALL' ? 'No advance entries yet' : 'No advance entries for this employee'}
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => setDateSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      className="-mx-1.5 -my-1 inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Sort by date, currently ${dateSortDir === 'asc' ? 'oldest first' : 'newest first'}`}
                    >
                      Date
                      {dateSortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </button>
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(tx.date)}</TableCell>
                    <TableCell className="font-medium">{employeeNameById.get(tx.employeeId) ?? 'Unknown'}</TableCell>
                    <TableCell>
                      <ToneBadge tone={tx.type === 'ADVANCE' ? 'warning' : 'success'}>
                        {tx.type === 'ADVANCE' ? 'Advance Given' : 'Advance Returned'}
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
