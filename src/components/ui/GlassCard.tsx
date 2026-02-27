import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={`
        bg-pm-surface/70
        backdrop-blur-xl
        border border-pm-border
        rounded-3xl
        shadow-[var(--pm-shadow-card)]
        ${className ?? ''}
      `}
    >
      {children}
    </div>
  );
}
