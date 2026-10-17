import { db } from '../database';
import type { Holiday } from '../../types';
import { newId } from '../../utils/id';

export async function listHolidays(): Promise<Holiday[]> {
  return db.holidays.orderBy('date').toArray();
}

export async function listHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]> {
  return db.holidays.where('date').between(startDate, endDate, true, true).toArray();
}

export async function getHolidayByDate(date: string): Promise<Holiday | undefined> {
  return db.holidays.where('date').equals(date).first();
}

export async function addHoliday(input: { date: string; name: string; paid: boolean }): Promise<Holiday> {
  const existing = await getHolidayByDate(input.date);
  if (existing) {
    throw new Error(`A holiday already exists on ${input.date}: "${existing.name}".`);
  }
  const holiday: Holiday = {
    id: newId(),
    date: input.date,
    name: input.name,
    type: 'HOLIDAY',
    paid: input.paid,
  };
  await db.holidays.add(holiday);
  return holiday;
}

export async function updateHoliday(id: string, changes: Partial<Omit<Holiday, 'id'>>): Promise<void> {
  await db.holidays.update(id, changes);
}

export async function deleteHoliday(id: string): Promise<void> {
  await db.holidays.delete(id);
}
