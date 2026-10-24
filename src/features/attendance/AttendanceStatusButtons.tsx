import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarkedAttendanceStatus } from '../../types';

// The `!` forces these to win over the outline button's own dark:bg-input/30 — without it, the
// active color was nearly invisible in dark mode since that rule outranks a plain bg-* class.
const OPTIONS: { status: MarkedAttendanceStatus; label: string; activeClass: string }[] = [
  { status: 'PRESENT', label: 'Present', activeClass: 'bg-green-600! text-white! hover:bg-green-600!' },
  { status: 'HALF_DAY', label: 'Half Day', activeClass: 'bg-amber-500! text-white! hover:bg-amber-500!' },
  { status: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600! text-white! hover:bg-red-600!' },
];

interface Props {
  value: MarkedAttendanceStatus | null;
  onChange: (status: MarkedAttendanceStatus) => void;
  /** When given, a "Not Marked" button is shown that removes the day's mark. */
  onClear?: () => void;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export function AttendanceStatusButtons({ value, onChange, onClear, size = 'md', ...rest }: Props) {
  const buttonSize = size === 'sm' ? 'sm' : 'default';
  return (
    <div className="inline-flex flex-wrap gap-1.5" role="group" aria-label={rest['aria-label'] ?? 'Attendance status'}>
      {OPTIONS.map((opt) => (
        <Button
          key={opt.status}
          type="button"
          size={buttonSize}
          variant="outline"
          aria-pressed={value === opt.status}
          onClick={() => onChange(opt.status)}
          className={cn(value === opt.status && opt.activeClass)}
        >
          {opt.label}
        </Button>
      ))}
      {onClear && (
        <Button
          type="button"
          size={buttonSize}
          variant="outline"
          aria-pressed={value === null}
          onClick={() => value !== null && onClear()}
          className={cn(value === null && 'bg-slate-500! text-white! hover:bg-slate-500!')}
        >
          Not Marked
        </Button>
      )}
    </div>
  );
}
