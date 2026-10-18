import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Users, UserCheck, UserX } from 'lucide-react';
import { setAttendanceStatus, clearAttendance, attendanceForDateQuery } from '../../db/repositories/attendance';
import { employeesQuery } from '../../db/repositories/employees';
import { settingsDocRef } from '../../db/repositories/settings';
import { useCollection, useDocument } from '../../firebase/hooks';
import { AttendanceStatusButtons } from './AttendanceStatusButtons';
import { EmployeeCalendarModal } from './EmployeeCalendarModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SummaryCard } from '@/components/summary-card';
import { EmptyState } from '@/components/empty-state';
import { DatePicker } from '@/components/date-picker';
import { PageLoader } from '@/components/spinner';
import { todayISO, weekdayOf, isWeeklyOffDay, WEEKDAY_LABELS } from '../../utils/dates';
import type { AppSettings, AttendanceRecord, Employee, MarkedAttendanceStatus } from '../../types';

export function AttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [calendarEmployee, setCalendarEmployee] = useState<Employee | null>(null);
  const employees = useCollection<Employee>(employeesQuery(), []);
  const settings = useDocument<AppSettings>(settingsDocRef(), []);
  const dayAttendance = useCollection<AttendanceRecord>(attendanceForDateQuery(date), [date]);

  const attendanceByEmployee = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    dayAttendance?.forEach((a) => map.set(a.employeeId, a));
    return map;
  }, [dayAttendance]);

  const presentCount = useMemo(
    () => (dayAttendance ?? []).filter((a) => a.status === 'PRESENT').length,
    [dayAttendance],
  );
  const absentCount = useMemo(() => (dayAttendance ?? []).filter((a) => a.status === 'ABSENT').length, [dayAttendance]);

  // Only employees who had already joined on the selected date can have their attendance marked for it.
  const visibleEmployees = useMemo(
    () => (employees ?? []).filter((emp) => emp.joiningDate <= date),
    [employees, date],
  );

  if (!employees || !settings) return <PageLoader />;

  const isWeeklyOff = isWeeklyOffDay(weekdayOf(date), settings.weeklyOffDay);
  const weeklyOffLabel = WEEKDAY_LABELS[settings.weeklyOffDay];

  async function markAll(status: MarkedAttendanceStatus) {
    if (visibleEmployees.length === 0) return;
    if (isWeeklyOff) {
      toast.warning('Marking attendance on a weekly-off day', {
        description: `${weeklyOffLabel} is configured as a paid weekly off.`,
      });
    }
    setBulkBusy(true);
    try {
      await Promise.all(visibleEmployees.map((emp) => setAttendanceStatus(emp.id, date, status)));
      toast.success(`Marked ${visibleEmployees.length} employee${visibleEmployees.length === 1 ? '' : 's'} as ${status === 'PRESENT' ? 'Present' : 'Absent'}`);
    } catch (err) {
      toast.error('Failed to bulk-mark attendance', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:w-80">
        <SummaryCard label="Present" value={presentCount} icon={UserCheck} tone="success" />
        <SummaryCard label="Absent" value={absentCount} icon={UserX} tone="danger" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark Present, Half Day or Absent for each employee on the selected date.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-date">Date</Label>
          <DatePicker id="attendance-date" value={date} onChange={setDate} disabled={(d) => d > new Date()} className="w-full sm:w-44" />
        </div>
      </div>

      {isWeeklyOff && <Badge variant="secondary">Weekly Off ({weeklyOffLabel})</Badge>}

      {visibleEmployees.length > 0 && (
        <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium">Bulk mark for all employees:</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={bulkBusy} onClick={() => markAll('PRESENT')}>
              Mark All Present
            </Button>
            <Button variant="secondary" disabled={bulkBusy} onClick={() => markAll('ABSENT')}>
              Mark All Absent
            </Button>
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description="Add employees first." />
      ) : visibleEmployees.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No employees had joined yet as of this date." />
      ) : (
        <div className="scrollbar-thin animate-in fade-in-0 overflow-x-auto rounded-xl border duration-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEmployees.map((emp) => (
                <AttendanceRow
                  key={emp.id}
                  employeeId={emp.id}
                  employeeName={emp.name}
                  date={date}
                  record={attendanceByEmployee.get(emp.id)}
                  onShowCalendar={() => setCalendarEmployee(emp)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {calendarEmployee && <EmployeeCalendarModal employee={calendarEmployee} onClose={() => setCalendarEmployee(null)} />}
    </div>
  );
}

function AttendanceRow({
  employeeId,
  employeeName,
  date,
  record,
  onShowCalendar,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  record: AttendanceRecord | undefined;
  onShowCalendar: () => void;
}) {
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const recordKey = `${record?.id ?? 'new'}-${date}`;
  const [lastKey, setLastKey] = useState(recordKey);
  if (lastKey !== recordKey) {
    setLastKey(recordKey);
    setNotes(record?.notes ?? '');
  }

  async function handleStatus(status: MarkedAttendanceStatus) {
    await setAttendanceStatus(employeeId, date, status, notes || null);
    setSavedAt(Date.now());
  }

  async function handleClear() {
    await clearAttendance(employeeId, date);
    setNotes('');
    setSavedAt(Date.now());
  }

  async function handleNotesBlur() {
    if (!record) return; // nothing to attach notes to until a status is set
    await setAttendanceStatus(employeeId, date, record.status, notes || null);
    setSavedAt(Date.now());
  }

  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-background font-medium">
        <div className="flex items-center gap-2">
          {employeeName}
          <button
            type="button"
            onClick={onShowCalendar}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`View attendance calendar for ${employeeName}`}
            title="View attendance calendar"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
      <TableCell>
        <AttendanceStatusButtons
          value={record?.status ?? null}
          onChange={handleStatus}
          onClear={handleClear}
          size="sm"
          aria-label={`Attendance status for ${employeeName}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Optional note"
          className="w-40 sm:w-48"
          aria-label={`Notes for ${employeeName}`}
        />
        {savedAt && <span className="ml-1 text-xs text-green-600">Saved</span>}
      </TableCell>
    </TableRow>
  );
}
