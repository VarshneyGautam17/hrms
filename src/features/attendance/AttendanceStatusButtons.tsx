import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarkedAttendanceStatus } from '../../types';

const OPTIONS: { status: MarkedAttendanceStatus; label: string; activeClass: string }[] = [
  { status: 'PRESENT', label: 'Present', activeClass: 'bg-green-600 text-white hover:bg-green-600' },
  { status: 'HALF_DAY', label: 'Half Day', activeClass: 'bg-amber-500 text-white hover:bg-amber-500' },
  { status: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600 text-white hover:bg-red-600' },
];

interface Props {
  value: MarkedAttendanceStatus | null;
  onChange: (status: MarkedAttendanceStatus) => void;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export function AttendanceStatusButtons({ value, onChange, size = 'md', ...rest }: Props) {
  return (
    <div className="inline-flex gap-1.5" role="group" aria-label={rest['aria-label'] ?? 'Attendance status'}>
      {OPTIONS.map((opt) => (
        <Button
          key={opt.status}
          type="button"
          size={size === 'sm' ? 'sm' : 'default'}
          variant="outline"
          aria-pressed={value === opt.status}
          onClick={() => onChange(opt.status)}
          className={cn(value === opt.status && opt.activeClass)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
