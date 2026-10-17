import { getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { userCollection, userDoc } from '../../firebase/paths';
import { newId } from '../../utils/id';
import type { AttendanceRecord, MarkedAttendanceStatus } from '../../types';

const COLLECTION = 'attendance';

/** One attendance doc per employee/day — the doc id itself enforces that uniqueness. */
function docId(employeeId: string, date: string): string {
  return `${employeeId}_${date}`;
}

export function attendanceDocRef(employeeId: string, date: string) {
  return userDoc(COLLECTION, docId(employeeId, date));
}

export async function getAttendanceForEmployeeDate(
  employeeId: string,
  date: string,
): Promise<AttendanceRecord | undefined> {
  const snap = await getDoc(userDoc(COLLECTION, docId(employeeId, date)));
  return snap.exists() ? (snap.data() as AttendanceRecord) : undefined;
}

export function allAttendanceQuery() {
  return userCollection(COLLECTION);
}

export function attendanceForDateQuery(date: string) {
  return query(userCollection(COLLECTION), where('date', '==', date));
}

export function attendanceForEmployeeQuery(employeeId: string) {
  return query(userCollection(COLLECTION), where('employeeId', '==', employeeId));
}

export async function listAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(attendanceForDateQuery(date));
  return snap.docs.map((d) => d.data() as AttendanceRecord);
}

export async function listAttendanceForEmployeeInRange(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  const snap = await getDocs(attendanceForEmployeeQuery(employeeId));
  return snap.docs.map((d) => d.data() as AttendanceRecord).filter((a) => a.date >= startDate && a.date <= endDate);
}

export async function listAttendanceInRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(
    query(userCollection(COLLECTION), where('date', '>=', startDate), where('date', '<=', endDate)),
  );
  return snap.docs.map((d) => d.data() as AttendanceRecord);
}

/** Sets (or overwrites) one employee's attendance for one day. */
export async function setAttendanceStatus(
  employeeId: string,
  date: string,
  status: MarkedAttendanceStatus,
  notes: string | null = null,
): Promise<AttendanceRecord> {
  const existing = await getAttendanceForEmployeeDate(employeeId, date);
  const record: AttendanceRecord = {
    id: existing?.id ?? newId(),
    employeeId,
    date,
    status,
    notes,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(userDoc(COLLECTION, docId(employeeId, date)), record);
  return record;
}
