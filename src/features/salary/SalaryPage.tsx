import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { employeesQuery } from '../../db/repositories/employees';
import { settingsDocRef } from '../../db/repositories/settings';
import { useCollection, useDocument } from '../../firebase/hooks';
import { computeSalarySlip, finalizeSalary, type SalarySlip } from '../../services/salaryService';
import { queueSalaryEmail } from '../../services/emailService';
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
import type { AppSettings, Employee } from '../../types';

export function SalaryPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
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
        <h1 className="text-xl font-semibold">Salary &amp; Records</h1>
        <p className="text-sm text-muted-foreground">Select an employee and a month to see their salary slip and final payable amount.</p>
      </div>

      <div className="flex flex-col gap-3 no-print sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? '')}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {(employees ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id} label={`${e.name} (${e.employeeCode})`}>
                  {e.name} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Period</Label>
          <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p} value={p} label={formatDisplayPeriod(p)}>
                  {formatDisplayPeriod(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!employees || employees.length === 0 ? (
        <p className="text-sm text-muted-foreground no-print">No employees yet. Add one from the Employees section.</p>
      ) : employeeId ? (
        <SalarySlipView employeeId={employeeId} period={period} />
      ) : null}
    </div>
  );
}

function SalarySlipView({ employeeId, period }: { employeeId: string; period: string }) {
  const settings = useDocument<AppSettings>(settingsDocRef(), []);
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
      await finalizeSalary(employeeId, slip, settings?.adminEmail ?? null);
      toast.success('Salary finalized', { description: `Final payable: ${formatPaiseAsINR(slip.snapshot.finalPayablePaise)}` });

      if (settings?.adminEmail) {
        try {
          await queueSalaryEmail(settings.adminEmail, slip);
          toast.info('Salary slip queued for email', { description: settings.adminEmail });
        } catch (err) {
          toast.error('Finalized, but failed to queue the email', { description: err instanceof Error ? err.message : undefined });
        }
      } else {
        toast.warning('No admin email configured', { description: 'Add one in Settings to email finalized slips automatically.' });
      }

      await loadSlip();
    } catch (err) {
      toast.error('Failed to finalize salary', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setFinalizing(false);
      setConfirmFinalizeOpen(false);
    }
  }

  if (!slip) return <PageLoader />;

  const s = slip.snapshot;
  const locked = slip.finalized || finalizing;

  return (
    <div className="flex flex-col gap-4">
      {slip.finalized ? (
        <div className="no-print flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Finalized on {formatDisplayDate(slip.finalizedAt!.slice(0, 10))}. This period is locked and will not change.
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3 no-print">
          <div className="flex w-full flex-col gap-1.5 sm:w-40">
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
            <span className="text-xs text-muted-foreground">Manual, authorized deduction for this period</span>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <Label htmlFor="advanceRepayment">Advance Repayment (₹)</Label>
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
              Outstanding: {formatPaiseAsINR(s.outstandingAdvanceBeforePaise)} · recorded in the advance ledger on finalize
            </span>
          </div>
        </div>
      )}

      <div className="print-area mx-auto w-full max-w-xl rounded-xl border bg-card p-5 sm:p-6">
        <div className="border-b pb-3 text-center">
          <p className="text-lg font-semibold">Salary Slip</p>
          <p className="text-sm text-muted-foreground">{formatDisplayPeriod(period)}</p>
          {slip.finalized && <p className="mt-1 text-xs font-medium text-green-700">FINALIZED</p>}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Employee Name</dt>
          <dd className="text-right font-medium">{slip.employee.name}</dd>
          <dt className="text-muted-foreground">Employee Code</dt>
          <dd className="text-right">{slip.employee.employeeCode}</dd>
          <dt className="text-muted-foreground">Department</dt>
          <dd className="text-right">{slip.employee.department ?? '—'}</dd>
          <dt className="text-muted-foreground">Attendance</dt>
          <dd className="text-right">
            {s.presentDays} Present · {s.halfDays} Half Day · {s.unpaidAbsentDays} Absent · {s.notMarkedDays} Not Marked ·{' '}
            {s.paidWeeklyOffDays} Weekly Off
          </dd>
        </dl>

        <div className="mt-4 border-t pt-3">
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

        <div className="mt-4 flex items-center justify-between rounded-md bg-muted px-3 py-2">
          <span className="text-sm font-semibold">Final Payable</span>
          <span className="text-lg font-bold text-green-700">{formatPaiseAsINR(s.finalPayablePaise)}</span>
        </div>

        <div className="mt-4 text-right text-xs text-muted-foreground">
          <span>Generated on {formatDisplayDate(todayISO())}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <Button variant="outline" onClick={() => window.print()} disabled={loading}>
          {loading && <Spinner />}
          Print Salary Slip
        </Button>
        {!slip.finalized && (
          <Button onClick={() => setConfirmFinalizeOpen(true)} disabled={finalizing || loading}>
            {finalizing && <Spinner />}
            Finalize Salary
          </Button>
        )}
      </div>

      <AlertDialog open={confirmFinalizeOpen} onOpenChange={setConfirmFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize salary for {slip.employee.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks {formatDisplayPeriod(period)} permanently — it can never be edited or re-finalized.
              {s.advanceRecoveredPaise > 0 &&
                ` It will record a repayment of ${formatPaiseAsINR(s.advanceRecoveredPaise)} in this employee's advance ledger.`}{' '}
              Final payable: <strong>{formatPaiseAsINR(s.finalPayablePaise)}</strong>.
              {settings?.adminEmail
                ? ` The slip will be emailed to ${settings.adminEmail}.`
                : ' No admin email is configured in Settings, so nothing will be emailed.'}
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className={`text-muted-foreground ${strong ? 'font-medium text-foreground' : ''}`}>{label}</dt>
      <dd className={`text-right ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </>
  );
}
