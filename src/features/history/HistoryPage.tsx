import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Download, History as HistoryIcon, Search } from 'lucide-react';
import { employeesQuery } from '../../db/repositories/employees';
import { allAttendanceQuery } from '../../db/repositories/attendance';
import { allAdvancesQuery } from '../../db/repositories/advances';
import { allPaymentsQuery } from '../../db/repositories/payments';
import { allFinalizationsQuery } from '../../db/repositories/salaryFinalizations';
import { settingsDocRef } from '../../db/repositories/settings';
import { useCollection, useDocument } from '../../firebase/hooks';
import {
  buildHistory,
  filterAndSortHistory,
  groupByMonth,
  totalsOf,
  HISTORY_SORT_LABELS,
  dayStatusLabel,
  eventLabel,
  type HistoryEvent,
  type HistoryRecord,
  type HistorySort,
} from '../../services/historyService';
import type { DayClassification } from '../../services/attendanceSummary';
import { ATTENDANCE_LEGEND, MonthGrid } from '../../components/calendar/MonthGrid';
import { format, parseISO } from 'date-fns';
import { buildHistoryPdf, historyFileName } from '../../services/historyPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToneBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { PageLoader } from '@/components/spinner';
import { cn } from '@/lib/utils';
import { formatPaiseAsINR } from '../../utils/currency';
import { currentPeriod, formatDisplayDate, formatDisplayPeriod, previousPeriods } from '../../utils/dates';
import type {
  AdvanceTransaction,
  AppSettings,
  AttendanceRecord,
  Employee,
  SalaryFinalization,
  SalaryPayment,
} from '../../types';

/** How far back the page goes, at most. */
const MAX_MONTHS = 36;

/** Lays out a record as one line of a six-column list on large screens; below that it stacks as a card. */
const ROW_GRID =
  'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,2.2fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)]';

export function HistoryPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const attendance = useCollection<AttendanceRecord>(allAttendanceQuery(), []);
  const advances = useCollection<AdvanceTransaction>(allAdvancesQuery(), []);
  const payments = useCollection<SalaryPayment>(allPaymentsQuery(), []);
  const finalizations = useCollection<SalaryFinalization>(allFinalizationsQuery(), []);
  const settings = useDocument<AppSettings>(settingsDocRef(), []);

  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('ALL');
  const [period, setPeriod] = useState('ALL');
  const [sort, setSort] = useState<HistorySort>('name');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [includeDays, setIncludeDays] = useState(true);

  // Every month from the earliest joining date up to now (newest first), capped at MAX_MONTHS.
  const periods = useMemo(() => {
    const earliest = (employees ?? []).reduce((min, e) => (e.joiningDate < min ? e.joiningDate : min), currentPeriod());
    return previousPeriods(MAX_MONTHS).filter((p) => p >= earliest.slice(0, 7));
  }, [employees]);

  const records = useMemo(() => {
    if (!employees || !attendance || !advances || !payments || !finalizations || !settings) return null;
    return buildHistory(
      { employees, attendance, advances, payments, finalizations, weeklyOffDay: settings.weeklyOffDay },
      periods,
    );
  }, [employees, attendance, advances, payments, finalizations, settings, periods]);

  const visible = useMemo(
    () => (records ? filterAndSortHistory(records, { search, employeeId, period, sort }) : []),
    [records, search, employeeId, period, sort],
  );

  if (!records || !employees) return <PageLoader />;

  // Passed to <Select items> so each trigger shows the label, not the raw value.
  const employeeItems = [
    { value: 'ALL', label: 'All Employees' },
    ...[...employees]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` })),
  ];
  const periodItems = [{ value: 'ALL', label: 'All Months' }, ...periods.map((p) => ({ value: p, label: formatDisplayPeriod(p) }))];
  const sortItems = (Object.keys(HISTORY_SORT_LABELS) as HistorySort[]).map((key) => ({ value: key, label: HISTORY_SORT_LABELS[key] }));

  const employeeLabel = employeeItems.find((i) => i.value === employeeId)?.label ?? 'All Employees';
  const periodLabel = periodItems.find((i) => i.value === period)?.label ?? 'All Months';
  const totals = totalsOf(visible);
  const groups = groupByMonth(visible);
  const filtersActive = search.trim() !== '' || employeeId !== 'ALL' || period !== 'ALL';

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDownload() {
    const createdAt = new Date();
    const summary = [
      `Employee: ${employeeLabel}`,
      `Month: ${periodLabel}`,
      search.trim() ? `Search: "${search.trim()}"` : null,
      `Sorted by: ${HISTORY_SORT_LABELS[sort]}`,
    ]
      .filter(Boolean)
      .join('   ·   ');
    buildHistoryPdf(visible, summary, createdAt, { includeDays }).save(
      historyFileName(employeeId === 'ALL' ? 'All Employees' : employeeLabel, period, createdAt),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">History</h1>
          <p className="text-sm text-muted-foreground">
            Month-by-month attendance, advances and salary paid for every employee.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button onClick={handleDownload} disabled={visible.length === 0} className="w-full sm:w-auto">
            <Download />
            Download PDF
          </Button>
          <label htmlFor="history-include-days" className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              id="history-include-days"
              type="checkbox"
              checked={includeDays}
              onChange={(e) => setIncludeDays(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Include day-by-day details
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="history-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="history-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or employee code"
              className="pl-8"
            />
          </div>
        </div>
        <FilterSelect label="Employee" items={employeeItems} value={employeeId} onChange={setEmployeeId} />
        <FilterSelect label="Month" items={periodItems} value={period} onChange={setPeriod} />
        <FilterSelect label="Sort by" items={sortItems} value={sort} onChange={(v) => setSort(v as HistorySort)} />
        {filtersActive && (
          <div className="sm:col-span-2 xl:col-span-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setEmployeeId('ALL');
                setPeriod('ALL');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Salary Paid" value={formatPaiseAsINR(totals.salaryPaidPaise)} className="text-green-700" />
        <Stat label="Advance Given" value={formatPaiseAsINR(totals.advanceGivenPaise)} className="text-amber-700" />
        <Stat label="Advance Returned" value={formatPaiseAsINR(totals.advanceReturnedPaise)} className="text-sky-700" />
        <Stat label="Records" value={String(visible.length)} />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={records.length === 0 ? 'No history yet' : 'No records match these filters'}
          description={records.length === 0 ? 'Add employees and mark attendance to start building history.' : 'Try clearing the search or picking another month.'}
        />
      ) : (
        groups.map((group) => {
          const monthTotals = totalsOf(group.records);
          return (
            <section key={group.period} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-base font-semibold">
                  {formatDisplayPeriod(group.period)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    · {group.records.length} employee{group.records.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Salary paid <span className="font-semibold text-foreground">{formatPaiseAsINR(monthTotals.salaryPaidPaise)}</span>
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                <div
                  className={cn(
                    'hidden gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid',
                    ROW_GRID,
                  )}
                >
                  <span>Employee</span>
                  <span>Attendance</span>
                  <span className="text-right">Paid Days</span>
                  <span className="text-right">Advance Given / Returned</span>
                  <span className="text-right">Salary Paid</span>
                  <span className="text-right">Status</span>
                </div>
                <ul className="divide-y">
                  {group.records.map((record) => {
                    const key = `${record.employee.id}_${record.period}`;
                    return (
                      <HistoryRow key={key} record={record} expanded={expanded.has(key)} onToggle={() => toggle(key)} />
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function HistoryRow({ record, expanded, onToggle }: { record: HistoryRecord; expanded: boolean; onToggle: () => void }) {
  const a = record.attendance;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn('grid w-full gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 lg:items-center', ROW_GRID)}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{record.employee.name}</p>
            <p className="truncate text-xs text-muted-foreground">{record.employee.employeeCode}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 lg:hidden">
            <StatusBadge record={record} />
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          <Chip className="bg-green-50 text-green-800">P {a.present}</Chip>
          <Chip className="bg-amber-50 text-amber-800">½ {a.halfDay}</Chip>
          <Chip className="bg-red-50 text-red-800">A {a.absent}</Chip>
          <Chip className="bg-muted text-foreground">NM {a.notMarked}</Chip>
          <Chip className="bg-sky-50 text-sky-800">WO {a.weeklyOff}</Chip>
          {a.workedOnOff > 0 && <Chip className="bg-violet-50 text-violet-800">+Off {a.workedOnOff}</Chip>}
        </div>

        <div className="grid grid-cols-3 gap-2 lg:contents">
          <Cell label="Paid Days">{a.paidDays}</Cell>
          <Cell label="Advance Given / Returned">
            <span className="text-amber-700">{formatPaiseAsINR(record.advanceGivenPaise)}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-sky-700">{formatPaiseAsINR(record.advanceReturnedPaise)}</span>
          </Cell>
          <Cell label="Salary Paid">
            <span className="font-semibold">{formatPaiseAsINR(record.salaryPaidPaise)}</span>
          </Cell>
        </div>

        <span className="hidden items-center justify-end gap-1.5 lg:flex">
          <StatusBadge record={record} />
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      {expanded && <HistoryDetails record={record} />}
    </li>
  );
}

/** The expanded part of a row: the salary breakdown, every payment and every advance entry for that month. */
function HistoryDetails({ record }: { record: HistoryRecord }) {
  const s = record.finalization?.snapshot;
  return (
    <div className="grid gap-3 border-t bg-muted/30 px-4 py-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
      <div className="sm:col-span-2 xl:col-span-3">
        <DayByDay record={record} />
      </div>

      <DetailBlock title="Salary">
        {s ? (
          <dl className="flex flex-col gap-1">
            <DetailLine label="Monthly Salary" value={formatPaiseAsINR(s.monthlySalaryPaise)} />
            <DetailLine label="Earned Salary" value={formatPaiseAsINR(s.earnedSalaryPaise)} />
            <DetailLine
              label="Deductions"
              value={`− ${formatPaiseAsINR(s.otherDeductionPaise + s.alreadyPaidPaise + s.advanceRecoveredPaise)}`}
            />
            <DetailLine label="Final Paid" value={formatPaiseAsINR(s.finalPayablePaise)} strong />
            <p className="text-xs text-muted-foreground">
              Finalized on {formatDisplayDate(record.finalization!.finalizedAt.slice(0, 10))}
            </p>
          </dl>
        ) : (
          <p className="text-muted-foreground">Salary not finalized for this month yet.</p>
        )}
      </DetailBlock>

      <DetailBlock title={`Salary Payments (${record.payments.length})`}>
        {record.payments.length === 0 ? (
          <p className="text-muted-foreground">No payments recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {record.payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {formatDisplayDate(p.date)} · {p.method}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatPaiseAsINR(p.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </DetailBlock>

      <DetailBlock title={`Advance Entries (${record.advances.length})`}>
        {record.advances.length === 0 ? (
          <p className="text-muted-foreground">No advance entries.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {record.advances.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {formatDisplayDate(t.date)} · {t.type === 'ADVANCE' ? 'Given' : 'Returned'}
                  {t.notes ? ` · ${t.notes}` : ''}
                </span>
                <span className={cn('shrink-0 font-medium tabular-nums', t.type === 'ADVANCE' ? 'text-amber-700' : 'text-sky-700')}>
                  {t.type === 'ADVANCE' ? '' : '− '}
                  {formatPaiseAsINR(t.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailBlock>
    </div>
  );
}

const DAY_STATUS_STYLES: Record<string, string> = {
  Present: 'bg-green-100 text-green-800',
  'Half Day': 'bg-amber-100 text-amber-800',
  Absent: 'bg-red-100 text-red-800',
  'Not Marked': 'bg-slate-100 text-slate-600',
  'Weekly Off': 'bg-sky-100 text-sky-800',
  'Worked on Weekly Off': 'bg-violet-100 text-violet-800',
  'Half Day on Weekly Off': 'bg-violet-100 text-violet-800',
  Upcoming: 'border border-dashed text-muted-foreground',
  'Before Joining': 'text-muted-foreground',
};

const EVENT_STYLES: Record<HistoryEvent['kind'], string> = {
  ADVANCE_GIVEN: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  ADVANCE_RETURNED: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
  SALARY_PAID: 'bg-green-50 text-green-800 ring-1 ring-green-200',
};

/** Every day of the employee's month: attendance, attendance note, and any money given, returned or paid that day. */
function DayByDay({ record }: { record: HistoryRecord }) {
  const [onlyActivity, setOnlyActivity] = useState(false);
  const shownDays = onlyActivity ? record.days.filter((d) => d.events.length > 0 || d.note) : record.days;

  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Day by Day · {formatDisplayPeriod(record.period)}
        </p>
        <div className="inline-flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Which days to show">
          {[
            { value: false, label: 'All days' },
            { value: true, label: 'Money & notes only' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={onlyActivity === opt.value}
              onClick={() => setOnlyActivity(opt.value)}
              className={cn(
                'rounded-md px-2 py-1 transition-colors',
                onlyActivity === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="max-w-[260px]">
            <MonthGrid period={record.period} days={record.days.map(toClassification)} showHeader={false} />
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {ATTENDANCE_LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
          {record.finalization && (
            <p className="text-[11px] text-muted-foreground">Days show attendance as it is marked now.</p>
          )}
        </div>

        {shownDays.length === 0 ? (
          <p className="text-muted-foreground">No advances, payments or notes this month.</p>
        ) : (
          <ul className="divide-y">
            {shownDays.map((day) => {
              const label = dayStatusLabel(day);
              return (
                <li key={day.date} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 py-1.5 sm:grid-cols-[6rem_minmax(0,1fr)]">
                  <span className="pt-0.5 tabular-nums">
                    <span className="font-medium">{format(parseISO(day.date), 'd MMM')}</span>{' '}
                    <span className="text-xs text-muted-foreground">{format(parseISO(day.date), 'EEE')}</span>
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', DAY_STATUS_STYLES[label])}>{label}</span>
                    {day.events.map((event, i) => (
                      <span key={i} className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', EVENT_STYLES[event.kind])}>
                        {eventLabel(event)} {formatPaiseAsINR(event.amountPaise)}
                        {event.method && event.method !== 'Salary' ? ` · ${event.method}` : ''}
                        {event.notes ? ` · ${event.notes}` : ''}
                      </span>
                    ))}
                    {day.note && <span className="text-xs break-words text-muted-foreground italic">“{day.note}”</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** MonthGrid colours days by DayClassification; the history days carry the same fields. */
function toClassification(day: HistoryRecord['days'][number]): DayClassification {
  return {
    date: day.date,
    status: day.status,
    weeklyOff: day.weeklyOff,
    paid: day.weeklyOff || day.status === 'PRESENT' || day.status === 'HALF_DAY',
    source:
      day.status === 'FUTURE' || day.status === 'NOT_MARKED' || day.status === 'OUTSIDE_EMPLOYMENT' || day.status === 'WEEKLY_OFF'
        ? day.status
        : 'ATTENDANCE',
  };
}

function StatusBadge({ record }: { record: HistoryRecord }) {
  return record.finalization ? <ToneBadge tone="success">Finalized</ToneBadge> : <ToneBadge tone="warning">Open</ToneBadge>;
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} label={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn('mt-1 text-base font-semibold tabular-nums break-words sm:text-xl', className)}>{value}</p>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums', className)}>{children}</span>;
}

/** A value with a small label above it on cards; on large screens the column header names it instead. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 lg:text-right">
      <p className="text-xs text-muted-foreground lg:hidden">{label}</p>
      <p className="tabular-nums break-words">{children}</p>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function DetailLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd className={cn('tabular-nums', strong && 'font-semibold text-green-700')}>{value}</dd>
    </div>
  );
}
