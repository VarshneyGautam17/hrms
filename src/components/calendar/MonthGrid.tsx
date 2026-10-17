import { periodToDate, formatDisplayPeriod } from '../../utils/dates';
import type { DayClassification } from '../../services/attendanceSummary';

export const ATTENDANCE_LEGEND: { label: string; className: string }[] = [
  { label: 'Present', className: 'bg-green-500' },
  { label: 'Half Day', className: 'bg-amber-500' },
  { label: 'Absent', className: 'bg-red-500' },
  { label: 'Weekly Off', className: 'bg-slate-300' },
  { label: 'Not Marked', className: 'bg-slate-100 border border-slate-200' },
  { label: 'Future', className: 'bg-white border border-dashed border-slate-200' },
];

const dayCellClass: Record<string, string> = {
  PRESENT: 'bg-green-500 text-white',
  HALF_DAY: 'bg-amber-500 text-white',
  ABSENT: 'bg-red-500 text-white',
  WEEKLY_OFF: 'bg-slate-300 text-slate-700',
  NOT_MARKED: 'bg-slate-100 text-slate-500 border border-slate-200',
  FUTURE: 'bg-white text-slate-300 border border-dashed border-slate-200',
  OUTSIDE_EMPLOYMENT: 'bg-transparent text-slate-300',
};

/** Days nobody has employment data for, or that haven't happened yet — never clickable to mark. */
const NON_ACTIONABLE_STATUSES = new Set(['OUTSIDE_EMPLOYMENT', 'FUTURE']);

export function MonthGrid({
  period,
  days,
  showHeader = true,
  onDayClick,
}: {
  period: string;
  days: DayClassification[];
  showHeader?: boolean;
  /** Called when a past-or-today day is clicked. Future/not-employed days never trigger this. */
  onDayClick?: (date: string) => void;
}) {
  const firstWeekday = periodToDate(period).getDay();
  const leadingBlanks = Array.from({ length: firstWeekday });

  return (
    <div className="rounded-xl border bg-card p-3">
      {showHeader && <p className="mb-2 text-sm font-semibold">{formatDisplayPeriod(period)}</p>}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {leadingBlanks.map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(-2));
          const title = d.source === 'OUTSIDE_EMPLOYMENT' ? 'Not employed' : d.source === 'FUTURE' ? 'Future' : d.source === 'NOT_MARKED' ? 'Not Marked' : d.status;
          const clickable = Boolean(onDayClick) && !NON_ACTIONABLE_STATUSES.has(d.status);
          return (
            <button
              key={d.date}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick?.(d.date)}
              title={`${d.date}: ${title}`}
              className={`flex aspect-square items-center justify-center rounded-sm text-[11px] ${
                dayCellClass[d.status] ?? 'bg-slate-100 text-slate-500'
              } ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-slate-400 hover:ring-offset-1' : 'cursor-default'}`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
