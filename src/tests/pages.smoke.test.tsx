import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '../db/database';
import { createEmployee } from '../db/repositories/employees';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { EmployeesPage } from '../features/employees/EmployeesPage';
import { EmployeeDetailPage } from '../features/employees/EmployeeDetailPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { SalaryPage } from '../features/salary/SalaryPage';
import { BackupPage } from '../features/backup/BackupPage';
import { SettingsPage } from '../features/settings/SettingsPage';

async function clearAll() {
  await db.transaction(
    'rw',
    [db.employees, db.attendance, db.advanceTransactions, db.salaryPayments, db.settings, db.appMetadata],
    async () => {
      await Promise.all([
        db.employees.clear(),
        db.attendance.clear(),
        db.advanceTransactions.clear(),
        db.salaryPayments.clear(),
        db.settings.clear(),
        db.appMetadata.clear(),
      ]);
    },
  );
}

beforeEach(async () => {
  await clearAll();
});

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('page smoke tests (render without crashing)', () => {
  it('Dashboard renders with no employees (empty state)', async () => {
    renderAt('/', <DashboardPage />);
    await waitFor(() => expect(screen.getByText(/no employees yet/i)).toBeInTheDocument());
  });

  it('Dashboard renders with data', async () => {
    await createEmployee({ employeeCode: 'S1', name: 'Smoke Test', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/', <DashboardPage />);
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Alerts')).toBeInTheDocument());
  });

  it('Employees page renders and lists an employee', async () => {
    await createEmployee({ employeeCode: 'S2', name: 'Jane Doe', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/employees', <EmployeesPage />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
  });

  it('Employee detail page renders for an existing employee', async () => {
    const emp = await createEmployee({ employeeCode: 'S3', name: 'Detail Person', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    render(
      <MemoryRouter initialEntries={[`/employees/${emp.id}`]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Detail Person')).toBeInTheDocument());
  });

  it('Attendance page renders', async () => {
    await createEmployee({ employeeCode: 'S4', name: 'Attend Person', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/attendance', <AttendancePage />);
    await waitFor(() => expect(screen.getByText('Attend Person')).toBeInTheDocument());
  });

  it('Advances page renders', async () => {
    renderAt('/advances', <AdvancesPage />);
    await waitFor(() => expect(screen.getByText('Advances')).toBeInTheDocument());
  });

  it('Salary & Records page renders and computes a preview', async () => {
    await createEmployee({ employeeCode: 'S5', name: 'Salary Person', joiningDate: '2026-01-01', monthlySalaryPaise: 2600000 });
    renderAt('/salary', <SalaryPage />);
    await waitFor(() => expect(screen.getByText('Final Payable')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('Backup page renders with a reset-all-data option', async () => {
    renderAt('/backup', <BackupPage />);
    await waitFor(() => expect(screen.getByText('Backup & Restore')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });

  it('Settings page renders and shows defaults', async () => {
    renderAt('/settings', <SettingsPage />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Salary Divisor')).toBeInTheDocument());
  });
});
