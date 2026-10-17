import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:bg-slate-100 disabled:text-slate-400';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, htmlFor, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint}>
      <input id={inputId} className={`${inputClasses} ${className}`} aria-invalid={Boolean(error)} {...props} />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function SelectField({ label, error, hint, id, className = '', children, ...props }: SelectFieldProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint}>
      <select id={inputId} className={`${inputClasses} bg-white ${className}`} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}
