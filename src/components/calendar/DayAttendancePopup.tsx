import { useEffect, useRef, useState } from 'react';
import { setAttendanceStatus } from '../../db/repositories/attendance';
import { AttendanceStatusButtons } from '../../features/attendance/AttendanceStatusButtons';
import { formatDisplayDate } from '../../utils/dates';
import type { Employee, MarkedAttendanceStatus } from '../../types';

interface Props {
  employee: Employee;
  date: string;
  currentStatus: MarkedAttendanceStatus | null;
  onClose: () => void;
}

/** Popup to mark Present/Half Day/Absent for one employee on one (past-or-today) date. */
export function DayAttendancePopup({ employee, date, currentStatus, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleStatus(status: MarkedAttendanceStatus) {
    await setAttendanceStatus(employee.id, date, status);
    setSavedAt(Date.now());
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-attendance-title"
        tabIndex={-1}
        className="w-full max-w-xs rounded-lg bg-white p-4 shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="day-attendance-title" className="text-sm font-semibold text-slate-900">
          {employee.name}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{formatDisplayDate(date)}</p>

        <div className="mt-3">
          <AttendanceStatusButtons
            value={currentStatus}
            onChange={handleStatus}
            size="sm"
            aria-label={`Attendance status for ${employee.name} on ${date}`}
          />
        </div>
        {savedAt && <p className="mt-2 text-xs text-green-600">Saved</p>}

        <button type="button" onClick={onClose} className="mt-4 text-xs text-slate-500 hover:underline">
          Close
        </button>
      </div>
    </div>
  );
}
