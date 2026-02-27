'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  showArrow?: boolean;
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

export function GlowButton({
  children,
  showArrow = true,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: GlowButtonProps) {
  const baseClasses = 'inline-flex items-center gap-2 font-semibold rounded-full transition-all duration-200 group';

  const variantClasses = {
    primary: 'bg-pm-accent text-pm-bg hover:bg-pm-accent-strong hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-pm-surface text-pm-ink-900 border border-pm-border-strong hover:bg-pm-surface-soft hover:border-pm-accent',
  };

  const sizeClasses = {
    sm: 'px-5 py-2.5 text-sm',
    default: 'px-7 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ''}`}
      {...props}
    >
      {children}
      {showArrow && (
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </button>
  );
}
