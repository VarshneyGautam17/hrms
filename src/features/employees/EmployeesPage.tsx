import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { employeesQuery, deleteEmployee } from '../../db/repositories/employees';
import { useCollection } from '../../firebase/hooks';
import { verifyCurrentPassword } from '../../firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { Spinner } from '@/components/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatPaiseAsINR } from '../../utils/currency';
import { EmployeeFormDialog } from './EmployeeFormDialog';
import type { Employee } from '../../types';

export function EmployeesPage() {
  const employees = useCollection<Employee>(employeesQuery(), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<Employee | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openPasswordStep() {
    setDeleting(null);
    setPasswordTarget(deleting);
    setPassword('');
    setPasswordError(null);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordTarget) return;
    setPasswordError(null);
    setDeleteBusy(true);
    try {
      await verifyCurrentPassword(password);
    } catch {
      setDeleteBusy(false);
      setPasswordError('Incorrect password. Try again.');
      return;
    }
    try {
      await deleteEmployee(passwordTarget.id);
      toast.success(`${passwordTarget.name} has been permanently deleted.`);
      setPasswordTarget(null);
      setPassword('');
    } catch (err) {
      toast.error('Failed to delete employee', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleteBusy(false);
    }
  }

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
                    <div className="flex items-center gap-3">
                      <button
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() => {
                          setEditing(e);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm font-medium text-destructive hover:underline"
                        onClick={() => setDeleting(e)}
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EmployeeFormDialog open={showForm} employee={editing} onClose={() => setShowForm(false)} />

      <AlertDialog open={!!deleting} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this employee along with all of their attendance, advance, payment and salary
              records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={openPasswordStep}>
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(next) => {
          if (!next) {
            setPasswordTarget(null);
            setPassword('');
            setPasswordError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>
              For your safety, re-enter your account password to permanently delete {passwordTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-employee-password">Password</Label>
              <Input
                id="delete-employee-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {passwordError && (
                <p className="text-sm text-destructive" role="alert">
                  {passwordError}
                </p>
              )}
            </div>
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setPasswordTarget(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteBusy || !password}>
                {deleteBusy && <Spinner />}
                Confirm &amp; Delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
