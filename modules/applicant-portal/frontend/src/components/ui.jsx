import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children }) {
  return <div className={cn('rounded-xl border border-slate-200/80 bg-white shadow-sm', className)}>{children}</div>;
}

export function CardHeader({ className, children }) {
  return <div className={cn('border-b border-slate-100 px-6 py-4', className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h2 className={cn('text-lg font-semibold tracking-tight text-slate-900', className)}>{children}</h2>;
}

export function CardContent({ className, children }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}

export function Button({ className, variant = 'default', children, ...props }) {
  const v = {
    default: 'bg-govNavy text-white hover:bg-slate-900',
    outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    ghost: 'text-govNavy hover:bg-slate-100',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-govNavy disabled:pointer-events-none disabled:opacity-50',
        v[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-inner shadow-slate-100 placeholder:text-slate-400 focus:border-govNavy focus:outline-none focus:ring-2 focus:ring-govNavy/20',
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn('mb-1 block text-sm font-medium text-slate-700', className)} {...props}>
      {children}
    </label>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-inner shadow-slate-100 focus:border-govNavy focus:outline-none focus:ring-2 focus:ring-govNavy/20',
        className
      )}
      {...props}
    />
  );
}
