import { periodToDate, formatDisplayPeriod } from '../../utils/dates';
import type { DayClassification } from '../../services/attendanceSummary';

export const ATTENDANCE_LEGEND: { label: string; className: string }[] = [
  { label: 'Present', className: 'bg-green-500' },
  { label: 'Half Day', className: 'bg-amber-500' },
  { label: 'Absent', className: 'bg-red-500' },
  { label: 'Weekly Off', className: 'bg-slate-300' },
  { label: 'Not marked', className: 'bg-slate-100 border border-slate-200' },
];

const dayCellClass: Record<string, string> = {
  PRESENT: 'bg-green-500 text-white',
  HALF_DAY: 'bg-amber-500 text-white',
  ABSENT: 'bg-red-500 text-white',
  WEEKLY_OFF: 'bg-slate-300 text-slate-700',
  OUTSIDE_EMPLOYMENT: 'bg-transparent text-slate-300',
};

export function MonthGrid({
  period,
  days,
  showHeader = true,
}: {
  period: string;
  days: DayClassification[];
  showHeader?: boolean;
}) {
  const firstWeekday = periodToDate(period).getDay();
  const leadingBlanks = Array.from({ length: firstWeekday });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      {showHeader && <p className="mb-2 text-sm font-semibold text-slate-700">{formatDisplayPeriod(period)}</p>}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">
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
          const title = d.source === 'OUTSIDE_EMPLOYMENT' ? 'Not employed' : d.source === 'NOT_MARKED' ? 'Not marked' : d.status;
          return (
            <span
              key={d.date}
              title={`${d.date}: ${title}`}
              className={`flex aspect-square items-center justify-center rounded-sm text-[11px] ${
                dayCellClass[d.status] ?? 'bg-slate-100 text-slate-500'
              }`}
            >
              {dayNum}
            </span>
          );
        })}
      </div>
    </div>
  );
}
