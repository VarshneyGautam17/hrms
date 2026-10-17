import { listAttendanceForDate } from '../db/repositories/attendance';
import { todayISO } from '../utils/dates';

export interface TodaySummary {
  presentToday: number;
  absentToday: number;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const todayAttendance = await listAttendanceForDate(todayISO());

  let presentToday = 0;
  let absentToday = 0;

  for (const record of todayAttendance) {
    if (record.status === 'PRESENT') presentToday += 1;
    else if (record.status === 'ABSENT') absentToday += 1;
  }

  return { presentToday, absentToday };
}
