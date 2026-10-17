import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/advances', label: 'Advances' },
  { to: '/salary', label: 'Salary & Records' },
  { to: '/backup', label: 'Backup & Restore' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="no-print hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-slate-900">HRMS</p>
          <p className="text-xs text-slate-500">Attendance &amp; Salary</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <p className="text-sm font-semibold">HRMS</p>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            Menu
          </button>
        </header>
        {mobileOpen && (
          <nav id="mobile-nav" className="no-print flex flex-col gap-1 border-b border-slate-200 bg-white p-2 md:hidden" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
