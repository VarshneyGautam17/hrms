import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../../db/repositories/settings';
import { listHolidaysInRange } from '../../db/repositories/holidays';
import { listAttendanceForEmployeeInRange } from '../../db/repositories/attendance';
import { summarizeAttendanceForEmployee, type DayClassification } from '../../services/attendanceSummary';
import { currentPeriod, previousPeriods, periodToDate, formatDisplayPeriod, daysInPeriod } from '../../utils/dates';
import type { Employee } from '../../types';

const LEGEND: { label: string; className: string }[] = [
  { label: 'Present', className: 'bg-green-500' },
  { label: 'Half Day', className: 'bg-amber-500' },
  { label: 'Absent', className: 'bg-red-500' },
  { label: 'Holiday', className: 'bg-purple-400' },
  { label: 'Weekly Off', className: 'bg-slate-300' },
  { label: 'Not marked', className: 'bg-slate-100 border border-slate-200' },
];

const dayCellClass: Record<string, string> = {
  PRESENT: 'bg-green-500 text-white',
  HALF_DAY: 'bg-amber-500 text-white',
  ABSENT: 'bg-red-500 text-white',
  HOLIDAY: 'bg-purple-400 text-white',
  WEEKLY_OFF: 'bg-slate-300 text-slate-700',
  OUTSIDE_EMPLOYMENT: 'bg-transparent text-slate-300',
};

/** Shows the last 3 months (current + 2 previous) as day-by-day attendance calendars. */
export function EmployeeAttendanceCalendar({ employee }: { employee: Employee }) {
  const periods = useMemo(() => previousPeriods(3, currentPeriod()), []);
  const settings = useLiveQuery(() => getSettings(), []);

  const firstDate = daysInPeriod(periods[periods.length - 1])[0];
  const lastDate = daysInPeriod(periods[0]).slice(-1)[0];

  const attendance = useLiveQuery(
    () => listAttendanceForEmployeeInRange(employee.id, firstDate, lastDate),
    [employee.id, firstDate, lastDate],
  );
  const holidays = useLiveQuery(() => listHolidaysInRange(firstDate, lastDate), [firstDate, lastDate]);

  if (!settings || !attendance || !holidays) return <p className="text-sm text-slate-500">Loading calendar…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {periods
          .slice()
          .reverse()
          .map((period) => {
            const { days } = summarizeAttendanceForEmployee(employee, period, attendance, holidays, settings);
            return <MonthGrid key={period} period={period} days={days} />;
          })}
      </div>
    </div>
  );
}

function MonthGrid({ period, days }: { period: string; days: DayClassification[] }) {
  const firstWeekday = periodToDate(period).getDay();
  const leadingBlanks = Array.from({ length: firstWeekday });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">{formatDisplayPeriod(period)}</p>
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
