import type { ReactNode } from 'react';
import type { AttendanceStatus } from '../../types';

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  HALF_DAY: 'bg-amber-100 text-amber-800',
  ABSENT: 'bg-red-100 text-red-800',
  HOLIDAY: 'bg-purple-100 text-purple-800',
  WEEKLY_OFF: 'bg-slate-200 text-slate-700',
};

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half Day',
  ABSENT: 'Absent',
  HOLIDAY: 'Holiday',
  WEEKLY_OFF: 'Weekly Off',
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClasses = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{children}</span>;
}
