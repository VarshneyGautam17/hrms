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
  className?: string;
  id?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, disabled, className, id, placeholder = 'Pick a date' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('w-full justify-start gap-2 font-normal', !value && 'text-muted-foreground', className)}
          />
        }
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
        {selected ? format(selected, 'dd MMM yyyy') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
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
