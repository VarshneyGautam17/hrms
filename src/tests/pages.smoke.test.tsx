import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { differenceInCalendarMonths, format, parseISO, startOfMonth } from 'date-fns';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { __resetFakeFirestore } from './mocks/fakeFirestore';
import { createEmployee } from '../db/repositories/employees';
import { ensureDefaultSettings, updateSettings } from '../db/repositories/settings';
import { setAttendanceStatus } from '../db/repositories/attendance';
import { EmployeesPage } from '../features/employees/EmployeesPage';
import { EmployeeDetailPage } from '../features/employees/EmployeeDetailPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { SalaryPage } from '../features/salary/SalaryPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { todayISO, weekdayOf } from '../utils/dates';

beforeEach(async () => {
  __resetFakeFirestore();
  // The real app ensures this exists once, in App.tsx, right after sign-in.
  await ensureDefaultSettings();
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
  it('Employees page renders with no employees (empty state)', async () => {
    renderAt('/', <EmployeesPage />);
    await waitFor(() => expect(screen.getByText(/no employees found/i)).toBeInTheDocument());
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

  it('Attendance page renders with Present/Absent counts first', async () => {
    await createEmployee({ employeeCode: 'S4', name: 'Attend Person', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/attendance', <AttendancePage />);
    await waitFor(() => expect(screen.getByText('Attend Person')).toBeInTheDocument());
    // "Present"/"Absent" also appear as per-row status buttons, so assert the summary card labels specifically.
    expect(screen.getAllByText('Present').some((el) => el.tagName === 'P')).toBe(true);
    expect(screen.getAllByText('Absent').some((el) => el.tagName === 'P')).toBe(true);
  });

  it('hides an employee from the attendance list for dates before they joined', async () => {
    await createEmployee({ employeeCode: 'S8', name: 'Future Joiner', joiningDate: '2026-06-15', monthlySalaryPaise: 10000 });
    renderAt('/attendance', <AttendancePage />);
    await waitFor(() => expect(screen.getByText('Future Joiner')).toBeInTheDocument());

    const user = userEvent.setup();

    async function pickDateInOpenCalendar(target: Date, navigate: boolean) {
      await user.click(screen.getByLabelText('Date'));
      if (navigate) {
        const diff = differenceInCalendarMonths(startOfMonth(new Date()), target);
        const navLabel = diff >= 0 ? 'Go to the Previous Month' : 'Go to the Next Month';
        for (let i = 0; i < Math.abs(diff); i++) {
          await user.click(await screen.findByRole('button', { name: navLabel }));
        }
      }
      const dayButton = await waitFor(() => {
        const el = document.querySelector<HTMLButtonElement>(`[data-day="${target.toLocaleDateString()}"]`);
        if (!el) throw new Error(`Day button for ${target.toDateString()} not found`);
        return el;
      });
      await user.click(dayButton);
    }

    await pickDateInOpenCalendar(new Date(2026, 5, 1), true);
    await waitFor(() => expect(screen.getByText('No employees had joined yet as of this date.')).toBeInTheDocument());
    expect(screen.queryByText('Future Joiner')).not.toBeInTheDocument();

    await pickDateInOpenCalendar(new Date(2026, 5, 15), false);
    await waitFor(() => expect(screen.getByText('Future Joiner')).toBeInTheDocument());
  });

  it('Attendance page opens a per-employee calendar modal defaulting to the current month', async () => {
    await createEmployee({ employeeCode: 'S6', name: 'Calendar Person', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/attendance', <AttendancePage />);
    await waitFor(() => expect(screen.getByText('Calendar Person')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'View attendance calendar for Calendar Person' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
  });

  it('clicking a past/today day in the calendar opens a mark-attendance popup; future days are disabled', async () => {
    await createEmployee({ employeeCode: 'S7', name: 'Click Person', joiningDate: '2026-01-01', monthlySalaryPaise: 10000 });
    renderAt('/attendance', <AttendancePage />);
    await waitFor(() => expect(screen.getByText('Click Person')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'View attendance calendar for Click Person' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const today = todayISO();
    const todayButton = await screen.findByTitle(new RegExp(`^${today}:`));
    expect(todayButton).not.toBeDisabled();

    await user.click(todayButton);
    await waitFor(() =>
      expect(screen.getByRole('group', { name: `Attendance status for Click Person on ${today}` })).toBeInTheDocument(),
    );

    const futureButtons = screen.getAllByTitle(/: Future$/);
    if (futureButtons.length > 0) {
      expect(futureButtons[0]).toBeDisabled();
    }
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

  it('Salary page lists the dates behind an attendance count when its box is clicked', async () => {
    const today = todayISO();
    // Make sure today is a normal working day, not the weekly off.
    await updateSettings({ weeklyOffDay: (weekdayOf(today) + 1) % 7 });
    const emp = await createEmployee({ employeeCode: 'S9', name: 'Dates Person', joiningDate: '2026-01-01', monthlySalaryPaise: 2600000 });
    await setAttendanceStatus(emp.id, today, 'PRESENT');

    renderAt('/salary', <SalaryPage />);
    const presentBox = await screen.findByRole('button', { name: /^1\s*Present$/ }, { timeout: 3000 });
    expect(screen.queryByText(/Present dates in/)).not.toBeInTheDocument();

    await userEvent.click(presentBox);
    expect(screen.getByText(/Present dates in/)).toBeInTheDocument();
    expect(screen.getByText(format(parseISO(today), 'EEE, d MMM'))).toBeInTheDocument();

    await userEvent.click(presentBox);
    expect(screen.queryByText(/Present dates in/)).not.toBeInTheDocument();
  });

  it('Settings page renders and shows defaults plus data management actions', async () => {
    renderAt('/settings', <SettingsPage />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Salary Divisor')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Export to CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset All Data' })).toBeInTheDocument();
  });
});
