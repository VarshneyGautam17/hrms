import type { MarkedAttendanceStatus } from '../../types';

const OPTIONS: { status: MarkedAttendanceStatus; label: string; activeClass: string }[] = [
  { status: 'PRESENT', label: 'Present', activeClass: 'bg-green-600 text-white border-green-600' },
  { status: 'HALF_DAY', label: 'Half Day', activeClass: 'bg-amber-500 text-white border-amber-500' },
  { status: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600 text-white border-red-600' },
];

interface Props {
  value: MarkedAttendanceStatus | null;
  onChange: (status: MarkedAttendanceStatus) => void;
  size?: 'sm' | 'md';
  "aria-label"?: string;
}

export function AttendanceStatusButtons({ value, onChange, size = 'md', ...rest }: Props) {
  const padding = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <div className="inline-flex gap-1.5" role="group" aria-label={rest['aria-label'] ?? 'Attendance status'}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.status}
          type="button"
          onClick={() => onChange(opt.status)}
          aria-pressed={value === opt.status}
          className={`rounded-md border font-medium transition-colors ${padding} ${
            value === opt.status ? opt.activeClass : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
