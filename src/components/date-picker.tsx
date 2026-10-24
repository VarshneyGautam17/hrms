import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DATE_FMT } from '../utils/dates';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: (date: Date) => boolean;
  /** Earliest selectable date (yyyy-MM-dd). Earlier days are disabled and earlier months can't be browsed. */
  minDate?: string;
  /** Disables the whole picker button. */
  triggerDisabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled,
  minDate,
  triggerDisabled,
  className,
  id,
  placeholder = 'Pick a date',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const isDisabled = (d: Date) => (minDate !== undefined && format(d, DATE_FMT) < minDate) || (disabled?.(d) ?? false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={triggerDisabled}
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('w-full justify-start gap-2 overflow-hidden font-normal', !value && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
        <span className="truncate">{selected ? format(selected, 'dd MMM yyyy') : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          startMonth={minDate ? parseISO(minDate) : undefined}
          disabled={isDisabled}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, DATE_FMT));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
