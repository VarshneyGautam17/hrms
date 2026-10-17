import { createHashRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { EmployeesPage } from '../features/employees/EmployeesPage';
import { EmployeeDetailPage } from '../features/employees/EmployeeDetailPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { SalaryPage } from '../features/salary/SalaryPage';
import { BackupPage } from '../features/backup/BackupPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// Hash routing (URLs like #/attendance) because GitHub Pages is a static
// host with no server-side rewrites — a direct link or refresh on a
// browser-history path would 404 without it.
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <EmployeesPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'employees/:id', element: <EmployeeDetailPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'advances', element: <AdvancesPage /> },
      { path: 'salary', element: <SalaryPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
