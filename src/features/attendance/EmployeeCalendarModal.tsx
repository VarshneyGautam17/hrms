import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAttendanceForEmployeeInRange } from '../../db/repositories/attendance';
import { summarizeAttendanceForEmployee } from '../../services/attendanceSummary';
import { ATTENDANCE_LEGEND, MonthGrid } from '../../components/calendar/MonthGrid';
import { currentPeriod, daysInPeriod, formatDisplayPeriod, periodToDate } from '../../utils/dates';
import { format, addMonths, subMonths } from 'date-fns';
import type { Employee } from '../../types';

interface Props {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeCalendarModal({ employee, onClose }: Props) {
  const [period, setPeriod] = useState(currentPeriod());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const days = daysInPeriod(period);
  const attendance = useLiveQuery(
    () => listAttendanceForEmployeeInRange(employee.id, days[0], days[days.length - 1]),
    [employee.id, days[0], days[days.length - 1]],
  );

  const classification = attendance ? summarizeAttendanceForEmployee(employee, period, attendance).days : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-calendar-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="employee-calendar-title" className="text-base font-semibold text-slate-900">
            {employee.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Close calendar"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPeriod(format(subMonths(periodToDate(period), 1), 'yyyy-MM'))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="text-sm font-medium text-slate-700">{formatDisplayPeriod(period)}</span>
          <button
            type="button"
            onClick={() => setPeriod(format(addMonths(periodToDate(period), 1), 'yyyy-MM'))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
          {ATTENDANCE_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-sm ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mt-3">
          {!classification ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <MonthGrid period={period} days={classification} showHeader={false} />
          )}
        </div>

        {period !== currentPeriod() && (
          <button type="button" onClick={() => setPeriod(currentPeriod())} className="mt-3 text-xs text-slate-500 hover:underline">
            Back to current month
          </button>
        )}
      </div>
    </div>
  );
}
