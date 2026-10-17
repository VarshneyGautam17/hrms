import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '../types';

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800 hover:bg-green-100',
  HALF_DAY: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  ABSENT: 'bg-red-100 text-red-800 hover:bg-red-100',
  WEEKLY_OFF: 'bg-slate-200 text-slate-700 hover:bg-slate-200',
};

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half Day',
  ABSENT: 'Absent',
  WEEKLY_OFF: 'Weekly Off',
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge className={statusStyles[status]}>{statusLabels[status]}</Badge>;
}

const toneStyles = {
  default: '',
  success: 'bg-green-100 text-green-800 hover:bg-green-100',
  warning: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  danger: 'bg-red-100 text-red-800 hover:bg-red-100',
} as const;

export function ToneBadge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: keyof typeof toneStyles;
}) {
  return <Badge className={cn(toneStyles[tone])}>{children}</Badge>;
}
