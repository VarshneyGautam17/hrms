import { useMemo, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, CalendarX, ReceiptText, Wallet } from 'lucide-react';
import { formatPaiseAsINR, parseRupeeInputToPaise } from '../../utils/currency';
import { formatDisplayDate, todayISO } from '../../utils/dates';
import { ToneBadge, StatusBadge } from '@/components/status-badge';
import { SummaryCard } from '@/components/summary-card';
import { MaskedAmount } from '@/components/masked-amount';
import { EmptyState } from '@/components/empty-state';
import { PageLoader } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/date-picker';
import { computeOutstandingBalance, giveAdvance, recordRepayment, advancesForEmployeeQuery } from '../../db/repositories/advances';
import { setAttendanceStatus, attendanceForEmployeeQuery, attendanceDocRef } from '../../db/repositories/attendance';
import { employeeDocRef } from '../../db/repositories/employees';
import { useCollection, useDocument } from '../../firebase/hooks';
import { AttendanceStatusButtons } from '../attendance/AttendanceStatusButtons';
import { EmployeeAttendanceCalendar } from './EmployeeAttendanceCalendar';
import { toCSV, downloadCSV } from '../../services/csvExport';
import type { AdvanceTransactionType, AdvanceTransaction, AttendanceRecord, Employee, MarkedAttendanceStatus } from '../../types';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const employee = useDocument<Employee>(id ? employeeDocRef(id) : null, [id]);
  const attendanceUnsorted = useCollection<AttendanceRecord>(id ? attendanceForEmployeeQuery(id) : null, [id]);
  const advancesUnsorted = useCollection<AdvanceTransaction>(id ? advancesForEmployeeQuery(id) : null, [id]);
  const attendance = useMemo(
    () => (attendanceUnsorted ? [...attendanceUnsorted].sort((a, b) => b.date.localeCompare(a.date)) : undefined),
    [attendanceUnsorted],
  );
  const advances = useMemo(
    () => (advancesUnsorted ? [...advancesUnsorted].sort((a, b) => a.date.localeCompare(b.date)) : undefined),
    [advancesUnsorted],
  );
  const today = todayISO();
  const todayRecord = useDocument<AttendanceRecord>(id ? attendanceDocRef(id, today) : null, [id, today]);

  if (!id) return null;
  if (employee === undefined) return <PageLoader />;

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
    toast.info('Attendance CSV downloaded', { description: `attendance-${emp.employeeCode}.csv` });
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
    toast.info('Advance ledger CSV downloaded', { description: `advance-ledger-${emp.employeeCode}.csv` });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/employees" className="text-sm text-muted-foreground hover:underline">
          ← Back to Employees
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{employee.name}</h1>
        <p className="text-sm text-muted-foreground">
          {employee.employeeCode} · {employee.department ?? 'No department'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Monthly Salary"
          value={<MaskedAmount value={formatPaiseAsINR(employee.monthlySalaryPaise)} />}
          icon={ReceiptText}
          tone="success"
        />
        <SummaryCard label="Joining Date" value={formatDisplayDate(employee.joiningDate)} icon={CalendarDays} tone="info" />
        <SummaryCard label="Advance Pending" value={formatPaiseAsINR(outstanding)} icon={Wallet} tone="warning" />
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Today's Attendance</h2>
        <p className="mt-1 text-xs text-muted-foreground">{formatDisplayDate(today)}</p>
        <div className="mt-3">
          <AttendanceStatusButtons value={todayRecord?.status ?? null} onChange={handleMarkToday} aria-label="Today's attendance status" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Attendance Calendar (Last 3 Months)</h2>
        <EmployeeAttendanceCalendar employee={employee} />
      </section>

      <AdvanceSection employeeId={id} joiningDate={employee.joiningDate} outstanding={outstanding} transactions={advances ?? []} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Attendance</h2>
          <button className="text-sm text-muted-foreground hover:underline" onClick={exportAttendanceCSV}>
            Export CSV
          </button>
        </div>
        {!attendance || attendance.length === 0 ? (
          <EmptyState icon={CalendarX} title="No attendance recorded yet" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.slice(0, 15).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(a.date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Advance Ledger</h2>
          <button className="text-sm text-muted-foreground hover:underline" onClick={exportAdvanceLedgerCSV}>
            Export CSV
          </button>
        </div>
        {!advances || advances.length === 0 ? (
          <EmptyState icon={Wallet} title="No advances recorded" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(tx.date)}</TableCell>
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

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Salary Slip</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          View and print this employee's salary slip for any month from the{' '}
          <Link to="/salary" className="underline">
            Salary &amp; Records
          </Link>{' '}
          section.
        </p>
      </section>
    </div>
  );
}

function AdvanceSection({
  employeeId,
  joiningDate,
  outstanding,
}: {
  employeeId: string;
  joiningDate: string;
  outstanding: number;
  transactions: { id: string; type: AdvanceTransactionType; amountPaise: number }[];
}) {
  const joinedInFuture = joiningDate > todayISO();
  const [mode, setMode] = useState<'ADVANCE' | 'REPAYMENT'>('ADVANCE');
  const [date, setDate] = useState(joinedInFuture ? '' : todayISO());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (joinedInFuture) {
      toast.warning(`Entries can be added from the joining date (${formatDisplayDate(joiningDate)}).`);
      return;
    }
    if (!date || date < joiningDate) {
      toast.warning(`Date cannot be before the joining date (${formatDisplayDate(joiningDate)}).`);
      return;
    }
    const amountPaise = parseRupeeInputToPaise(amount);
    if (amountPaise <= 0) {
      toast.warning('Amount must be greater than zero.');
      return;
    }
    try {
      if (mode === 'ADVANCE') {
        await giveAdvance({ employeeId, date, amountPaise, notes: notes.trim() || null });
        toast.success('Advance recorded.');
      } else {
        await recordRepayment({ employeeId, date, amountPaise, notes: notes.trim() || null });
        toast.success('Returned amount recorded.');
      }
      setAmount('');
      setNotes('');
    } catch (err) {
      toast.error('Failed to record transaction', { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Advance Payment</h2>
        <p className="text-sm text-muted-foreground">
          Advance pending: <span className="font-semibold text-foreground">{formatPaiseAsINR(outstanding)}</span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={mode === 'ADVANCE' ? 'default' : 'secondary'} onClick={() => setMode('ADVANCE')}>
          Give Advance
        </Button>
        <Button type="button" size="sm" variant={mode === 'REPAYMENT' ? 'default' : 'secondary'} onClick={() => setMode('REPAYMENT')}>
          Advance Returned
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="emp-advance-date">Date</Label>
          <DatePicker
            id="emp-advance-date"
            value={date}
            onChange={setDate}
            minDate={joiningDate}
            disabled={(d) => d > new Date()}
            triggerDisabled={joinedInFuture}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="emp-advance-amount">Amount (₹)</Label>
          <Input id="emp-advance-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="emp-advance-notes">Notes (optional)</Label>
          <Input id="emp-advance-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="sm:col-span-2 lg:col-span-1 lg:w-fit">
          {mode === 'ADVANCE' ? 'Give Advance' : 'Save Returned Amount'}
        </Button>
      </form>
    </section>
  );
}
