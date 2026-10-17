import { db } from '../database';
import type { Employee } from '../../types';
import { newId } from '../../utils/id';

export interface NewEmployeeInput {
  employeeCode: string;
  name: string;
  joiningDate: string;
  phone?: string | null;
  department?: string | null;
  monthlySalaryPaise: number;
}

export async function listEmployees(): Promise<Employee[]> {
  return db.employees.orderBy('name').toArray();
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  return db.employees.get(id);
}

export async function isEmployeeCodeTaken(code: string, excludeId?: string): Promise<boolean> {
  const match = await db.employees.where('employeeCode').equals(code).first();
  if (!match) return false;
  return match.id !== excludeId;
}

export async function createEmployee(input: NewEmployeeInput): Promise<Employee> {
  const taken = await isEmployeeCodeTaken(input.employeeCode);
  if (taken) {
    throw new Error(`Employee code "${input.employeeCode}" is already in use.`);
  }
  const now = new Date().toISOString();
  const employee: Employee = {
    id: newId(),
    employeeCode: input.employeeCode,
    name: input.name,
    joiningDate: input.joiningDate,
    phone: input.phone ?? null,
    department: input.department ?? null,
    monthlySalaryPaise: input.monthlySalaryPaise,
    createdAt: now,
    updatedAt: now,
  };
  await db.employees.add(employee);
  return employee;
}

export async function updateEmployee(
  id: string,
  changes: Partial<Omit<Employee, 'id' | 'createdAt'>>,
): Promise<void> {
  if (changes.employeeCode) {
    const taken = await isEmployeeCodeTaken(changes.employeeCode, id);
    if (taken) {
      throw new Error(`Employee code "${changes.employeeCode}" is already in use.`);
    }
  }
  await db.employees.update(id, { ...changes, updatedAt: new Date().toISOString() });
}
