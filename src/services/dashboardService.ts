import { db } from '../db/database';
import { listAttendanceForDate } from '../db/repositories/attendance';
import { listAdvancesInRange } from '../db/repositories/advances';
import { previewSettlement } from './settlementService';
import { todayISO, daysInPeriod } from '../utils/dates';

export interface TodaySummary {
  totalEmployees: number;
  presentToday: number;
  halfDayToday: number;
  absentToday: number;
  notMarkedToday: number;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const [employees, todayAttendance] = await Promise.all([db.employees.toArray(), listAttendanceForDate(todayISO())]);

  const byEmployee = new Map(todayAttendance.map((a) => [a.employeeId, a]));

  let presentToday = 0;
  let halfDayToday = 0;
  let absentToday = 0;
  let notMarkedToday = 0;

  for (const emp of employees) {
    const record = byEmployee.get(emp.id);
    if (!record) {
      notMarkedToday += 1;
      continue;
    }
    switch (record.status) {
      case 'PRESENT':
        presentToday += 1;
        break;
      case 'HALF_DAY':
        halfDayToday += 1;
        break;
      case 'ABSENT':
        absentToday += 1;
        break;
    }
  }

  return {
    totalEmployees: employees.length,
    presentToday,
    halfDayToday,
    absentToday,
    notMarkedToday,
  };
}

export interface MonthSummary {
  period: string;
  totalAdvancesIssuedPaise: number;
  estimatedPayablePaise: number;
  presentDays: number;
  totalMarkedDays: number;
}

export async function getMonthSummary(period: string): Promise<MonthSummary> {
  const employees = await db.employees.toArray();
  const days = daysInPeriod(period);
  const advances = await listAdvancesInRange(days[0], days[days.length - 1]);
  const totalAdvancesIssuedPaise = advances
    .filter((a) => a.type === 'ADVANCE')
    .reduce((sum, a) => sum + a.amountPaise, 0);

  let estimatedPayablePaise = 0;
  let presentDays = 0;
  let totalMarkedDays = 0;

  for (const emp of employees) {
    try {
      const preview = await previewSettlement(emp.id, period);
      estimatedPayablePaise += preview.snapshot.finalPayablePaise;
      presentDays += preview.snapshot.presentDays + 0.5 * preview.snapshot.halfDays;
      totalMarkedDays += preview.days.filter((d) => d.source !== 'OUTSIDE_EMPLOYMENT').length;
    } catch {
      // Employee may have been removed/changed concurrently; skip rather than fail the whole dashboard.
    }
  }

  return { period, totalAdvancesIssuedPaise, estimatedPayablePaise, presentDays, totalMarkedDays };
}

export interface DashboardAlerts {
  notMarkedToday: number;
  employeesWithOutstandingAdvances: number;
}

export async function getDashboardAlerts(): Promise<DashboardAlerts> {
  const [employees, todayAttendance] = await Promise.all([db.employees.toArray(), listAttendanceForDate(todayISO())]);

  const markedToday = new Set(todayAttendance.map((a) => a.employeeId));
  const notMarkedToday = employees.filter((e) => !markedToday.has(e.id)).length;

  const advances = await db.advanceTransactions.toArray();
  const byEmployee = new Map<string, number>();
  for (const tx of advances) {
    const delta = tx.type === 'ADVANCE' ? tx.amountPaise : -tx.amountPaise;
    byEmployee.set(tx.employeeId, (byEmployee.get(tx.employeeId) ?? 0) + delta);
  }
  const employeesWithOutstandingAdvances = [...byEmployee.values()].filter((v) => v > 0).length;

  return { notMarkedToday, employeesWithOutstandingAdvances };
}
