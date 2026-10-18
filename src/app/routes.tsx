import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { EmployeesPage } from '../features/employees/EmployeesPage';
import { EmployeeDetailPage } from '../features/employees/EmployeeDetailPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { SalaryPage } from '../features/salary/SalaryPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// Firebase Hosting rewrites every path to index.html (see firebase.json),
// so normal browser routing works fine — no # needed in the URLs.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <AttendancePage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'employees/:id', element: <EmployeeDetailPage /> },
      { path: 'advances', element: <AdvancesPage /> },
      { path: 'salary', element: <SalaryPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
