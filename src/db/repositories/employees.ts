import { getDoc, getDocs, setDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { userCollection, userDoc } from '../../firebase/paths';
import type { Employee } from '../../types';
import { newId } from '../../utils/id';

const COLLECTION = 'employees';

export function employeesQuery() {
  return query(userCollection(COLLECTION), orderBy('name'));
}

export function employeeDocRef(id: string) {
  return userDoc(COLLECTION, id);
}

export interface NewEmployeeInput {
  employeeCode: string;
  name: string;
  joiningDate: string;
  phone?: string | null;
  department?: string | null;
  monthlySalaryPaise: number;
}

export async function listEmployees(): Promise<Employee[]> {
  const snap = await getDocs(employeesQuery());
  return snap.docs.map((d) => d.data() as Employee);
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const snap = await getDoc(userDoc(COLLECTION, id));
  return snap.exists() ? (snap.data() as Employee) : undefined;
}

export async function isEmployeeCodeTaken(code: string, excludeId?: string): Promise<boolean> {
  const snap = await getDocs(query(userCollection(COLLECTION), where('employeeCode', '==', code)));
  return snap.docs.some((d) => d.id !== excludeId);
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
  await setDoc(userDoc(COLLECTION, employee.id), employee);
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
  await updateDoc(userDoc(COLLECTION, id), { ...changes, updatedAt: new Date().toISOString() });
}
