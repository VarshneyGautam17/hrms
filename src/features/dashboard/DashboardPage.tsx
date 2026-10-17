import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { getTodaySummary, getMonthSummary, getDashboardAlerts, type MonthSummary } from '../../services/dashboardService';
import { SummaryCard, Card, EmptyState } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatPaiseAsINR } from '../../utils/currency';
import { currentPeriod, previousPeriods, formatDisplayPeriod } from '../../utils/dates';

export function DashboardPage() {
  const employeeCount = useLiveQuery(() => db.employees.count(), []);
  const [today, setToday] = useState<Awaited<ReturnType<typeof getTodaySummary>> | null>(null);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof getDashboardAlerts>> | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const periods = previousPeriods(3);

  useEffect(() => {
    getTodaySummary().then(setToday);
    getDashboardAlerts().then(setAlerts);
  }, [employeeCount]);

  useEffect(() => {
    setLoadingMonth(true);
    getMonthSummary(period)
      .then(setMonthSummary)
      .finally(() => setLoadingMonth(false));
  }, [period, employeeCount]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of today's attendance and this month's payroll status.</p>
      </div>

      {employeeCount === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add your first employee from the Employees section to start tracking attendance and salary."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total Employees" value={today?.totalEmployees ?? '—'} />
            <SummaryCard label="Present Today" value={today?.presentToday ?? '—'} />
            <SummaryCard label="Half Day Today" value={today?.halfDayToday ?? '—'} />
            <SummaryCard label="Absent Today" value={today?.absentToday ?? '—'} />
            <SummaryCard label="Not Marked Today" value={today?.notMarkedToday ?? '—'} />
            <SummaryCard
              label="Advances This Month"
              value={monthSummary ? formatPaiseAsINR(monthSummary.totalAdvancesIssuedPaise) : '—'}
            />
            <SummaryCard
              label="Est. Salary Payable"
              value={monthSummary ? formatPaiseAsINR(monthSummary.estimatedPayablePaise) : '—'}
              hint="Based on current attendance; may change until finalized"
            />
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-slate-700">Alerts</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {alerts && alerts.notMarkedToday > 0 && (
                <Badge tone="warning">{alerts.notMarkedToday} employee(s) not marked today</Badge>
              )}
              {alerts && alerts.employeesWithOutstandingAdvances > 0 && (
                <Badge tone="default">{alerts.employeesWithOutstandingAdvances} employee(s) have outstanding advances</Badge>
              )}
              {alerts && alerts.notMarkedToday === 0 && alerts.employeesWithOutstandingAdvances === 0 && (
                <Badge tone="success">No alerts today</Badge>
              )}
            </div>
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Monthly History</h2>
              <div className="flex gap-1">
                {periods.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      p === period ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {formatDisplayPeriod(p)}
                  </button>
                ))}
              </div>
            </div>
            {loadingMonth || !monthSummary ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard label="Full/Half Present Days (all employees)" value={monthSummary.presentDays} />
                <SummaryCard label="Advances Issued" value={formatPaiseAsINR(monthSummary.totalAdvancesIssuedPaise)} />
                <SummaryCard label="Estimated Payable" value={formatPaiseAsINR(monthSummary.estimatedPayablePaise)} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
