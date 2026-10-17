import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { setAttendanceStatus } from '../../db/repositories/attendance';
import { AttendanceStatusButtons } from './AttendanceStatusButtons';
import { EmployeeCalendarModal } from './EmployeeCalendarModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SummaryCard } from '../../components/ui/Card';
import { TextField } from '../../components/ui/Field';
import { todayISO, weekdayOf, isWeeklyOffDay } from '../../utils/dates';
import type { AttendanceRecord, Employee, MarkedAttendanceStatus } from '../../types';

export function AttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [calendarEmployee, setCalendarEmployee] = useState<Employee | null>(null);
  const employees = useLiveQuery(() => db.employees.orderBy('name').toArray(), []);
  const dayAttendance = useLiveQuery(() => db.attendance.where('date').equals(date).toArray(), [date]);

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

  if (!employees) return <p className="text-sm text-slate-500">Loading…</p>;

  const isWeeklyOff = isWeeklyOffDay(weekdayOf(date));

  async function markAll(status: MarkedAttendanceStatus) {
    if (!employees || employees.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(employees.map((emp) => setAttendanceStatus(emp.id, date, status)));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:w-80">
        <SummaryCard label="Present" value={presentCount} />
        <SummaryCard label="Absent" value={absentCount} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500">Mark Present, Half Day or Absent for each employee on the selected date.</p>
        </div>
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>

      {isWeeklyOff && <Badge>Weekly Off (Monday)</Badge>}

      {employees.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <span className="text-sm font-medium text-slate-700">Bulk mark for all employees:</span>
          <Button variant="secondary" disabled={bulkBusy} onClick={() => markAll('PRESENT')}>
            Mark All Present
          </Button>
          <Button variant="secondary" disabled={bulkBusy} onClick={() => markAll('ABSENT')}>
            Mark All Absent
          </Button>
        </div>
      )}

      {employees.length === 0 ? (
        <p className="text-sm text-slate-500">No active employees yet. Add employees first.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Employee</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <AttendanceRow
                  key={emp.id}
                  employeeId={emp.id}
                  employeeName={emp.name}
                  date={date}
                  record={attendanceByEmployee.get(emp.id)}
                  onShowCalendar={() => setCalendarEmployee(emp)}
                />
              ))}
            </tbody>
          </table>
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

  async function handleNotesBlur() {
    if (!record) return; // nothing to attach notes to until a status is set
    await setAttendanceStatus(employeeId, date, record.status, notes || null);
    setSavedAt(Date.now());
  }

  return (
    <tr>
      <td className="px-3 py-2 font-medium text-slate-900">
        <div className="flex items-center gap-2">
          {employeeName}
          <button
            type="button"
            onClick={onShowCalendar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`View attendance calendar for ${employeeName}`}
            title="View attendance calendar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-3 py-2">
        <AttendanceStatusButtons
          value={record?.status ?? null}
          onChange={handleStatus}
          size="sm"
          aria-label={`Attendance status for ${employeeName}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Optional note"
          className="w-48 rounded-md border border-slate-300 px-2 py-1 text-sm"
          aria-label={`Notes for ${employeeName}`}
        />
        {savedAt && <span className="ml-1 text-xs text-green-600">Saved</span>}
      </td>
    </tr>
  );
}
