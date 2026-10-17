import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { createEmployee, updateEmployee } from '../../db/repositories/employees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/date-picker';
import { Spinner } from '@/components/spinner';
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
      toast.success(employee ? 'Employee updated' : 'Employee added', {
        description: `${name.trim()} (${employeeCode.trim()})`,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save employee.';
      setError(message);
      toast.error('Failed to save employee', { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        </DialogHeader>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeCode">Employee Code</Label>
            <Input id="employeeCode" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="joiningDate">Joining Date</Label>
            <DatePicker id="joiningDate" value={joiningDate} onChange={setJoiningDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Department (optional)</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="salary">Monthly Salary (₹)</Label>
            <Input
              id="salary"
              type="number"
              min="0"
              step="0.01"
              value={salaryRupees}
              onChange={(e) => setSalaryRupees(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="col-span-full text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="col-span-full -mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
