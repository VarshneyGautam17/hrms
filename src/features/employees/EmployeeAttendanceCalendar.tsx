import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAttendanceForEmployeeInRange } from '../../db/repositories/attendance';
import { summarizeAttendanceForEmployee } from '../../services/attendanceSummary';
import { ATTENDANCE_LEGEND, MonthGrid } from '../../components/calendar/MonthGrid';
import { DayAttendancePopup } from '../../components/calendar/DayAttendancePopup';
import { currentPeriod, previousPeriods, daysInPeriod } from '../../utils/dates';
import type { Employee } from '../../types';

/** Shows the last 3 months (current + 2 previous) as day-by-day attendance calendars. */
export function EmployeeAttendanceCalendar({ employee }: { employee: Employee }) {
  const periods = useMemo(() => previousPeriods(3, currentPeriod()), []);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const firstDate = daysInPeriod(periods[periods.length - 1])[0];
  const lastDate = daysInPeriod(periods[0]).slice(-1)[0];

  const attendance = useLiveQuery(
    () => listAttendanceForEmployeeInRange(employee.id, firstDate, lastDate),
    [employee.id, firstDate, lastDate],
  );

  if (!attendance) return <p className="text-sm text-slate-500">Loading calendar…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {ATTENDANCE_LEGEND.map((item) => (
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
            const { days } = summarizeAttendanceForEmployee(employee, period, attendance);
            return <MonthGrid key={period} period={period} days={days} onDayClick={setEditingDate} />;
          })}
      </div>

      {editingDate && (
        <DayAttendancePopup
          employee={employee}
          date={editingDate}
          currentStatus={attendance.find((a) => a.date === editingDate)?.status ?? null}
          onClose={() => setEditingDate(null)}
        />
      )}
    </div>
  );
}
