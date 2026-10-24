import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shows "₹ ••••••" until the eye icon next to it is clicked, then the real amount. */
export function MaskedAmount({ value, className }: { value: string; className?: string }) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="tabular-nums">{shown ? value : '₹ ••••••'}</span>
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Hide salary' : 'Show salary'}
        title={shown ? 'Hide salary' : 'Show salary'}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Icon className="h-4 w-4" />
      </button>
    </span>
  );
}
