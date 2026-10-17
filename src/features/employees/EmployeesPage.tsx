import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Card';
import { formatPaiseAsINR } from '../../utils/currency';
import { EmployeeFormDialog } from './EmployeeFormDialog';
import type { Employee } from '../../types';

export function EmployeesPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => {
      const q = search.trim().toLowerCase();
      return !q || e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q);
    });
  }, [employees, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">{employees?.length ?? 0} total employees</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          Add Employee
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
          aria-label="Search employees"
        />
      </div>

      {employees === undefined ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No employees found" description="Add your first employee to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Code</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Department</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Monthly Salary</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">{e.employeeCode}</td>
                  <td className="px-4 py-2">
                    <Link to={`/employees/${e.id}`} className="font-medium text-slate-900 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{e.department ?? '—'}</td>
                  <td className="px-4 py-2">{formatPaiseAsINR(e.monthlySalaryPaise)}</td>
                  <td className="px-4 py-2">
                    <button
                      className="text-sm font-medium text-slate-700 hover:underline"
                      onClick={() => {
                        setEditing(e);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmployeeFormDialog open={showForm} employee={editing} onClose={() => setShowForm(false)} />
    </div>
  );
}
