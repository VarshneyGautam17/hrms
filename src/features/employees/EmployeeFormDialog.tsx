import { useEffect, useState, type FormEvent } from 'react';
import { createEmployee, updateEmployee } from '../../db/repositories/employees';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { parseRupeeInputToPaise, paiseToRupees } from '../../utils/currency';
import { todayISO } from '../../utils/dates';
import type { Employee } from '../../types';

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}

export function EmployeeFormDialog({ open, employee, onClose }: Props) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [joiningDate, setJoiningDate] = useState(todayISO());
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [salaryRupees, setSalaryRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (employee) {
      setEmployeeCode(employee.employeeCode);
      setName(employee.name);
      setJoiningDate(employee.joiningDate);
      setPhone(employee.phone ?? '');
      setDepartment(employee.department ?? '');
      setSalaryRupees(String(paiseToRupees(employee.monthlySalaryPaise)));
    } else {
      setEmployeeCode('');
      setName('');
      setJoiningDate(todayISO());
      setPhone('');
      setDepartment('');
      setSalaryRupees('');
    }
    setError(null);
  }, [open, employee]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employeeCode.trim() || !name.trim() || !joiningDate) {
      setError('Employee code, name, and joining date are required.');
      return;
    }
    const monthlySalaryPaise = parseRupeeInputToPaise(salaryRupees);
    if (monthlySalaryPaise <= 0) {
      setError('Monthly salary must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          employeeCode: employeeCode.trim(),
          name: name.trim(),
          joiningDate,
          phone: phone.trim() || null,
          department: department.trim() || null,
          monthlySalaryPaise,
        });
      } else {
        await createEmployee({
          employeeCode: employeeCode.trim(),
          name: name.trim(),
          joiningDate,
          phone: phone.trim() || null,
          department: department.trim() || null,
          monthlySalaryPaise,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
        <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <TextField label="Employee Code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
          <TextField label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField
            label="Joining Date"
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            required
          />
          <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField label="Department (optional)" value={department} onChange={(e) => setDepartment(e.target.value)} />
          <TextField
            label="Monthly Salary (₹)"
            type="number"
            min="0"
            step="0.01"
            value={salaryRupees}
            onChange={(e) => setSalaryRupees(e.target.value)}
            required
          />

          {error && (
            <p className="col-span-full text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="col-span-full flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
