import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children }) {
  return (
    <div className={cn("bg-white rounded-lg border shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn("px-6 py-4 border-b bg-gray-50/50 rounded-t-lg", className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h3 className={cn("text-lg font-semibold text-gray-900 tracking-tight", className)}>{children}</h3>;
}

export function CardContent({ className, children }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export function Button({ className, variant = "default", children, ...props }) {
  const variants = {
    default: "bg-govNavy text-white hover:bg-blue-900",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    destructive: "bg-govRed text-white hover:bg-red-700",
    success: "bg-govGreen text-white hover:bg-green-800"
  };
  return (
    <button 
      className={cn("px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-govNavy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed", variants[variant], className)} 
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return (
    <input 
      className={cn("flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-govNavy focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700", className)} {...props}>
      {children}
    </label>
  );
}

export function Badge({ className, variant = "default", children }) {
    const variants = {
        default: "bg-gray-100 text-gray-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        danger: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800"
    };
    return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
            {children}
        </span>
    );
}
