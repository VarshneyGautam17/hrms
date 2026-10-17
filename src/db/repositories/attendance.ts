import { db } from '../database';
import type { AttendanceRecord, MarkedAttendanceStatus } from '../../types';
import { newId } from '../../utils/id';

export async function getAttendanceForEmployeeDate(
  employeeId: string,
  date: string,
): Promise<AttendanceRecord | undefined> {
  return db.attendance.where('[employeeId+date]').equals([employeeId, date]).first();
}

export async function listAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  return db.attendance.where('date').equals(date).toArray();
}

export async function listAttendanceForEmployeeInRange(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  const all = await db.attendance.where('employeeId').equals(employeeId).toArray();
  return all.filter((a) => a.date >= startDate && a.date <= endDate);
}

export async function listAttendanceInRange(
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  return db.attendance.where('date').between(startDate, endDate, true, true).toArray();
}

/** Sets (or clears, when status is null) one employee's attendance for one day. */
export async function setAttendanceStatus(
  employeeId: string,
  date: string,
  status: MarkedAttendanceStatus,
  notes: string | null = null,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceForEmployeeDate(employeeId, date);
  const now = new Date().toISOString();

  if (existing) {
    const updated: AttendanceRecord = { ...existing, status, notes, updatedAt: now };
    await db.attendance.put(updated);
    return updated;
  }

  const record: AttendanceRecord = {
    id: newId(),
    employeeId,
    date,
    status,
    notes,
    updatedAt: now,
  };
  await db.attendance.add(record);
  return record;
}

export async function deleteAttendance(id: string): Promise<void> {
  await db.attendance.delete(id);
}
