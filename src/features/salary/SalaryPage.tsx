import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { computeSalarySlip, finalizeSalary, type SalarySlip } from '../../services/salaryService';
import { downloadSalarySlipPdf, printSalarySlip } from '../../services/pdfService';
import { paidDaysOf } from '../../services/salaryCalculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { PageLoader, Spinner } from '@/components/spinner';
import { formatPaiseAsINR, parseRupeeInputToPaise, paiseToRupees } from '../../utils/currency';
import { currentPeriod, previousPeriods, formatDisplayPeriod, todayISO, formatDisplayDate } from '../../utils/dates';
import type { Employee } from '../../types';
import type { DayClassification } from '../../services/attendanceSummary';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export function SalaryPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const [period, setPeriod] = useState(currentPeriod());
  const [employeeId, setEmployeeId] = useState('');

  const periods = [currentPeriod(), ...previousPeriods(12).slice(1)];
  // Passed to <Select items> so the trigger shows the label, not the raw value (an employee id / "YYYY-MM").
  const employeeItems = (employees ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` }));
  const periodItems = periods.map((p) => ({ value: p, label: formatDisplayPeriod(p) }));

  useEffect(() => {
    if (!employeeId && employees && employees.length > 0) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  const selectors = (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Employee</Label>
        <Select items={employeeItems} value={employeeId} onValueChange={(v) => setEmployeeId(v ?? '')}>
          <SelectTrigger className="w-full">
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
      <div className="flex flex-col gap-1.5">
        <Label>Month</Label>
        <Select items={periodItems} value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodItems.map((item) => (
              <SelectItem key={item.value} value={item.value} label={item.label}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print">
        <h1 className="text-xl font-semibold">Salary &amp; Records</h1>
        <p className="text-sm text-muted-foreground">
          Choose the employee and month on the left. The salary slip preview updates on the right.
        </p>
      </div>

      {!employees || employees.length === 0 ? (
        <p className="text-sm text-muted-foreground no-print">No employees yet. Add one from the Employees section.</p>
      ) : employeeId ? (
        <SalarySlipView employeeId={employeeId} period={period} selectors={selectors} />
      ) : null}
    </div>
  );
}

function SalarySlipView({
  employeeId,
  period,
  selectors,
}: {
  employeeId: string;
  period: string;
  selectors: ReactNode;
}) {
  const [otherDeduction, setOtherDeduction] = useState('0');
  const [advanceRepayment, setAdvanceRepayment] = useState('0');
  const [advanceRepaymentTouched, setAdvanceRepaymentTouched] = useState(false);
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);

  async function loadSlip() {
    setLoading(true);
    try {
      const otherDeductionPaise = parseRupeeInputToPaise(otherDeduction);
      const advanceRepaymentPaise = advanceRepaymentTouched ? parseRupeeInputToPaise(advanceRepayment) : undefined;
      const result = await computeSalarySlip(employeeId, period, otherDeductionPaise, advanceRepaymentPaise);
      setSlip(result);
      if (!advanceRepaymentTouched && !result.finalized) {
        setAdvanceRepayment(String(paiseToRupees(result.snapshot.maxRecoverablePaise)));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOtherDeduction('0');
    setAdvanceRepayment('0');
    setAdvanceRepaymentTouched(false);
  }, [employeeId, period]);

  useEffect(() => {
    loadSlip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, period, otherDeduction, advanceRepayment]);

  async function handleFinalize() {
    if (!slip || slip.finalized) return;
    setFinalizing(true);
    try {
      await finalizeSalary(employeeId, slip);
      toast.success('Salary finalized', { description: `Final payable: ${formatPaiseAsINR(slip.snapshot.finalPayablePaise)}` });

      downloadSalarySlipPdf({ ...slip, finalized: true, finalizedAt: new Date().toISOString() });
      await loadSlip();
    } catch (err) {
      toast.error('Failed to finalize salary', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setFinalizing(false);
      setConfirmFinalizeOpen(false);
    }
  }

  if (!slip)
    return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 no-print">{selectors}</div>
        <PageLoader />
      </div>
    );

  const s = slip.snapshot;
  const locked = slip.finalized || finalizing;
  const totalDeductionsPaise = s.otherDeductionPaise + s.alreadyPaidPaise + s.advanceRecoveredPaise;
  const weeklyOffExtraPaise = s.weeklyOffExtraPaise ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)] print:block">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 no-print lg:sticky lg:top-4">
          <p className="text-sm font-semibold">Salary Details</p>
          {selectors}

          {slip.finalized ? (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Finalized on {formatDisplayDate(slip.finalizedAt!.slice(0, 10))}. This month is locked and will not
              change.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 border-t pt-4">
                <Label htmlFor="otherDeduction">Other Deduction (₹)</Label>
                <Input
                  id="otherDeduction"
                  type="number"
                  min="0"
                  step="0.01"
                  value={otherDeduction}
                  onChange={(e) => setOtherDeduction(e.target.value)}
                  disabled={locked}
                />
                <span className="text-xs text-muted-foreground">Any extra amount to cut this month</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="advanceRepayment">Advance to Cut from Salary (₹)</Label>
                <Input
                  id="advanceRepayment"
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceRepayment}
                  onChange={(e) => {
                    setAdvanceRepaymentTouched(true);
                    setAdvanceRepayment(e.target.value);
                  }}
                  disabled={locked}
                />
                <span className="text-xs text-muted-foreground">
                  Advance pending: {formatPaiseAsINR(s.outstandingAdvanceBeforePaise)}
                </span>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2 border-t pt-4">
            {!slip.finalized && (
              <Button onClick={() => setConfirmFinalizeOpen(true)} disabled={finalizing || loading}>
                {finalizing && <Spinner />}
                Finalize Salary
              </Button>
            )}
            <Button variant="outline" onClick={() => downloadSalarySlipPdf(slip)} disabled={loading}>
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => printSalarySlip(slip)} disabled={loading}>
              {loading && <Spinner />}
              Print Salary Slip
            </Button>
          </div>
        </div>

        <div className="print-area w-full rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-lg font-semibold">{slip.employee.name}</p>
              <p className="text-sm text-muted-foreground">
                {slip.employee.employeeCode}
                {slip.employee.department ? ` · ${slip.employee.department}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Salary Slip</p>
              <p className="font-semibold">{formatDisplayPeriod(period)}</p>
              {slip.finalized && <p className="text-xs font-medium text-green-700">FINALIZED</p>}
            </div>
          </div>

          <Section title="Attendance">
            <AttendanceBreakdown slip={slip} />
          </Section>

          <Section title="Earnings">
            <dl className="divide-y text-sm">
              <Row label="Monthly Salary" value={formatPaiseAsINR(s.monthlySalaryPaise)} />
              <Row
                label="Per Day Rate"
                hint={`Monthly salary ÷ ${s.divisor} days`}
                value={formatPaiseAsINR(Math.round(s.dailyRatePaise))}
              />
              <PaidDaysRow slip={slip} />
              <Row
                label="Unpaid Days"
                hint={`Absent ${s.unpaidAbsentDays} + Not Marked ${s.notMarkedDays} + ½ of ${s.halfDays} Half Day`}
                value={`${s.unpaidDayEquivalents} days (${formatPaiseAsINR(s.attendanceDeductionPaise)} not paid)`}
              />
              <Row
                label="Salary for Paid Days"
                hint="Per day rate × paid days"
                value={formatPaiseAsINR(s.earnedSalaryPaise - weeklyOffExtraPaise)}
              />
              <Row
                label="Extra: Worked on Weekly Off"
                hint={`${s.weeklyOffWorkedDays ?? 0} days × per day rate`}
                value={`+ ${formatPaiseAsINR(weeklyOffExtraPaise)}`}
              />
              <Row label="Earned Salary" value={formatPaiseAsINR(s.earnedSalaryPaise)} strong />
            </dl>
          </Section>

          <Section title="Deductions">
            <dl className="divide-y text-sm">
              <Row label="Other Deduction" value={`− ${formatPaiseAsINR(s.otherDeductionPaise)}`} />
              <Row label="Already Paid" value={`− ${formatPaiseAsINR(s.alreadyPaidPaise)}`} />
              <Row label="Advance Cut from Salary" value={`− ${formatPaiseAsINR(s.advanceRecoveredPaise)}`} />
              <Row label="Total Deductions" value={`− ${formatPaiseAsINR(totalDeductionsPaise)}`} strong />
            </dl>
          </Section>

          <div className="mt-5 flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
            <span className="font-semibold text-green-900">Final Payable</span>
            <span className="text-2xl font-bold text-green-700">{formatPaiseAsINR(s.finalPayablePaise)}</span>
          </div>

          <Section title="Advance">
            <dl className="divide-y text-sm">
              <Row label="Advance Pending" hint="Before this salary" value={formatPaiseAsINR(s.outstandingAdvanceBeforePaise)} />
              <Row label="Advance Cut from Salary" value={`− ${formatPaiseAsINR(s.advanceRecoveredPaise)}`} />
              <Row label="Advance Still Pending" value={formatPaiseAsINR(s.advanceCarriedForwardPaise)} strong />
            </dl>
          </Section>

          <p className="mt-4 text-right text-xs text-muted-foreground">Generated on {formatDisplayDate(todayISO())}</p>
        </div>
      </div>

      <AlertDialog open={confirmFinalizeOpen} onOpenChange={setConfirmFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize salary for {slip.employee.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks {formatDisplayPeriod(period)} permanently — it can never be edited or re-finalized.
              {s.advanceRecoveredPaise > 0 &&
                ` It will record ${formatPaiseAsINR(s.advanceRecoveredPaise)} as advance returned in this employee's advance entries.`}{' '}
              Amount to pay: <strong>{formatPaiseAsINR(s.finalPayablePaise)}</strong>. A PDF receipt will download
              automatically once finalized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>Finalize</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** How much one day adds to Paid Days, or null when it isn't paid. */
function paidDayValue(d: DayClassification): { value: number; label: string } | null {
  if (d.weeklyOff) return { value: 1, label: 'Weekly Off' };
  if (d.status === 'PRESENT') return { value: 1, label: 'Present' };
  if (d.status === 'HALF_DAY') return { value: 0.5, label: 'Half Day' };
  return null;
}

const NOT_PAID_LABELS: Record<string, string> = {
  ABSENT: 'Absent',
  NOT_MARKED: 'Not Marked',
  FUTURE: 'Future (not happened yet)',
  OUTSIDE_EMPLOYMENT: 'Before joining',
};

/** The "Paid Days" line. Clicking it shows the sum worked out and every date behind it. */
function PaidDaysRow({ slip }: { slip: SalarySlip }) {
  const s = slip.snapshot;
  const [open, setOpen] = useState(false);

  const paidDays = slip.days.flatMap((d) => {
    const paid = paidDayValue(d);
    return paid ? [{ day: d, ...paid }] : [];
  });
  const notPaidCounts = new Map<string, number>();
  for (const d of slip.days) {
    if (paidDayValue(d)) continue;
    const label = NOT_PAID_LABELS[d.status] ?? d.status;
    notPaidCounts.set(label, (notPaidCounts.get(label) ?? 0) + 1);
  }

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-4 text-left"
      >
        <span className="text-muted-foreground">
          Paid Days
          <span className="block text-xs">
            Present + ½ Half Day + Weekly Off
            <span className="no-print">{' · '}</span>
            <span className="no-print text-primary underline underline-offset-2">{open ? 'Hide dates' : 'Show dates'}</span>
          </span>
        </span>
        <span className="tabular-nums">
          {paidDaysOf(s)} of {s.totalDaysInMonth}
        </span>
      </button>

      {open && (
        <div className="no-print mt-2 flex flex-col gap-3 rounded-lg border bg-background p-3 text-xs">
          <p className="font-medium">
            {s.presentDays} Present + ½ × {s.halfDays} Half Day + {s.paidWeeklyOffDays} Weekly Off ={' '}
            <span className="font-semibold">{paidDaysOf(s)} paid days</span>
          </p>

          {paidDays.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {paidDays.map(({ day, value, label }) => (
                <span
                  key={day.date}
                  className={cn(
                    'rounded-md px-2 py-1 font-medium',
                    label === 'Present' && 'bg-green-50 text-green-800',
                    label === 'Half Day' && 'bg-amber-50 text-amber-800',
                    label === 'Weekly Off' && 'bg-sky-50 text-sky-800',
                  )}
                >
                  {format(parseISO(day.date), 'EEE, d MMM')} · {label}
                  {value === 0.5 && ' (½)'}
                </span>
              ))}
            </div>
          )}

          {notPaidCounts.size > 0 && (
            <p className="text-muted-foreground">
              Not counted:{' '}
              {[...notPaidCounts].map(([label, count]) => `${label} ${count}`).join(' · ')}
            </p>
          )}
          {slip.finalized && <p className="text-muted-foreground">Dates show the attendance as it is marked now.</p>}
        </div>
      )}
    </div>
  );
}

interface AttendanceCategory {
  key: string;
  label: string;
  count: number;
  className: string;
  matches: (d: DayClassification) => boolean;
}

/** The attendance count boxes. Clicking one lists the dates behind that count. */
function AttendanceBreakdown({ slip }: { slip: SalarySlip }) {
  const s = slip.snapshot;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const categories: AttendanceCategory[] = [
    {
      key: 'present',
      label: 'Present',
      count: s.presentDays,
      className: 'bg-green-50 text-green-800',
      matches: (d) => !d.weeklyOff && d.status === 'PRESENT',
    },
    {
      key: 'half',
      label: 'Half Day',
      count: s.halfDays,
      className: 'bg-amber-50 text-amber-800',
      matches: (d) => !d.weeklyOff && d.status === 'HALF_DAY',
    },
    {
      key: 'absent',
      label: 'Absent',
      count: s.unpaidAbsentDays,
      className: 'bg-red-50 text-red-800',
      matches: (d) => !d.weeklyOff && d.status === 'ABSENT',
    },
    {
      key: 'notMarked',
      label: 'Not Marked',
      count: s.notMarkedDays,
      className: 'bg-muted text-foreground',
      matches: (d) => d.status === 'NOT_MARKED',
    },
    {
      key: 'weeklyOff',
      label: 'Weekly Off',
      count: s.paidWeeklyOffDays,
      className: 'bg-sky-50 text-sky-800',
      matches: (d) => d.weeklyOff,
    },
    {
      key: 'workedOnOff',
      label: 'Worked on Off',
      count: s.weeklyOffWorkedDays ?? 0,
      className: 'bg-violet-50 text-violet-800',
      matches: (d) => d.weeklyOff && (d.status === 'PRESENT' || d.status === 'HALF_DAY'),
    },
  ];

  const selected = categories.find((c) => c.key === selectedKey) ?? null;
  const selectedDays = selected ? slip.days.filter(selected.matches) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setSelectedKey(selectedKey === c.key ? null : c.key)}
            aria-pressed={selectedKey === c.key}
            title={`Show ${c.label} dates`}
            className={cn(
              'rounded-lg px-2 py-2 text-center transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              c.className,
              selectedKey === c.key && 'ring-2 ring-current print:ring-0',
            )}
          >
            <p className="text-xl font-semibold">{c.count}</p>
            <p className="text-xs">{c.label}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="no-print rounded-lg border bg-background p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {selected.label} dates in {formatDisplayPeriod(slip.period)}
          </p>
          {selectedDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {selected.label.toLowerCase()} days this month.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedDays.map((d) => (
                <span key={d.date} className={cn('rounded-md px-2 py-1 text-xs font-medium', selected.className)}>
                  {format(parseISO(d.date), 'EEE, d MMM')}
                  {selected.key === 'workedOnOff' && d.status === 'HALF_DAY' && ' (half day)'}
                </span>
              ))}
            </div>
          )}
          {slip.finalized && (
            <p className="mt-2 text-xs text-muted-foreground">Dates show the attendance as it is marked now.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>
        {label}
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
