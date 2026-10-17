import { db } from '../database';
import type { SalarySettlement } from '../../types';

export async function getSettlement(
  employeeId: string,
  period: string,
): Promise<SalarySettlement | undefined> {
  return db.salarySettlements.where('[employeeId+period]').equals([employeeId, period]).first();
}

export async function listSettlementsForPeriod(period: string): Promise<SalarySettlement[]> {
  return db.salarySettlements.where('period').equals(period).toArray();
}

export async function listSettlementsForEmployee(employeeId: string): Promise<SalarySettlement[]> {
  return db.salarySettlements.where('employeeId').equals(employeeId).sortBy('period');
}
