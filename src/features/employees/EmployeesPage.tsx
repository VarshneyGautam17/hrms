import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { employeesQuery } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
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
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees?.length ?? 0} total employees</p>
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
        <Input
          type="search"
          placeholder="Search by name or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
          aria-label="Search employees"
        />
      </div>

      {employees === undefined ? (
        <TableSkeleton cols={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees found" description="Add your first employee to get started." />
      ) : (
        <div className="scrollbar-thin animate-in fade-in-0 overflow-x-auto rounded-xl border duration-300">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead className="sticky left-0 bg-background">Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Monthly Salary</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{e.employeeCode}</TableCell>
                  <TableCell className="sticky left-0 bg-background">
                    <Link to={`/employees/${e.id}`} className="font-medium hover:text-primary hover:underline">
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.department ?? '—'}</TableCell>
                  <TableCell>{formatPaiseAsINR(e.monthlySalaryPaise)}</TableCell>
                  <TableCell>
                    <button
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={() => {
                        setEditing(e);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EmployeeFormDialog open={showForm} employee={editing} onClose={() => setShowForm(false)} />
    </div>
  );
}
