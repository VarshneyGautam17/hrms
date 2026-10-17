import { useState } from 'react';
import { setAttendanceStatus } from '../../db/repositories/attendance';
import { AttendanceStatusButtons } from '../../features/attendance/AttendanceStatusButtons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleStatus(status: MarkedAttendanceStatus) {
    await setAttendanceStatus(employee.id, date, status);
    setSavedAt(Date.now());
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{employee.name}</DialogTitle>
          <DialogDescription>{formatDisplayDate(date)}</DialogDescription>
        </DialogHeader>

        <AttendanceStatusButtons
          value={currentStatus}
          onChange={handleStatus}
          size="sm"
          aria-label={`Attendance status for ${employee.name} on ${date}`}
        />
        {savedAt && <p className="text-xs text-green-600">Saved</p>}
      </DialogContent>
    </Dialog>
  );
}
