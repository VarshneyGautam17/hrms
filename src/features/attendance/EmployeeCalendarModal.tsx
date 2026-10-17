import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { attendanceForEmployeeQuery } from '../../db/repositories/attendance';
import { settingsDocRef } from '../../db/repositories/settings';
import { useCollection, useDocument } from '../../firebase/hooks';
import { summarizeAttendanceForEmployee } from '../../services/attendanceSummary';
import { ATTENDANCE_LEGEND, MonthGrid } from '../../components/calendar/MonthGrid';
import { DayAttendancePopup } from '../../components/calendar/DayAttendancePopup';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { currentPeriod, daysInPeriod, formatDisplayPeriod, periodToDate } from '../../utils/dates';
import { format, addMonths, subMonths } from 'date-fns';
import type { AppSettings, AttendanceRecord, Employee } from '../../types';

interface Props {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeCalendarModal({ employee, onClose }: Props) {
  const [period, setPeriod] = useState(currentPeriod());
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const days = daysInPeriod(period);
  const firstDate = days[0];
  const lastDate = days[days.length - 1];
  const allAttendance = useCollection<AttendanceRecord>(attendanceForEmployeeQuery(employee.id), [employee.id]);
  const attendance = useMemo(
    () => allAttendance?.filter((a) => a.date >= firstDate && a.date <= lastDate),
    [allAttendance, firstDate, lastDate],
  );
  const settings = useDocument<AppSettings>(settingsDocRef(), []);

  const classification =
    attendance && settings ? summarizeAttendanceForEmployee(employee, period, attendance, settings.weeklyOffDay).days : null;

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{employee.name}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPeriod(format(subMonths(periodToDate(period), 1), 'yyyy-MM'))}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </Button>
            <span className="text-sm font-medium">{formatDisplayPeriod(period)}</span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPeriod(format(addMonths(periodToDate(period), 1), 'yyyy-MM'))}
              aria-label="Next month"
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {ATTENDANCE_LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>

          <div>
            {!classification ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner />
                Loading…
              </div>
            ) : (
              <MonthGrid period={period} days={classification} showHeader={false} onDayClick={setEditingDate} />
            )}
          </div>

          {period !== currentPeriod() && (
            <button type="button" onClick={() => setPeriod(currentPeriod())} className="text-xs text-muted-foreground hover:underline">
              Back to current month
            </button>
          )}
        </DialogContent>
      </Dialog>

      {editingDate && (
        <DayAttendancePopup
          employee={employee}
          date={editingDate}
          currentStatus={attendance?.find((a) => a.date === editingDate)?.status ?? null}
          onClose={() => setEditingDate(null)}
        />
      )}
    </>
  );
}
