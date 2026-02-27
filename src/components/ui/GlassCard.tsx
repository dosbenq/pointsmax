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
        border border-white/[0.08]
        rounded-3xl
        shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]
        ${className ?? ''}
      `}
    >
      {children}
    </div>
  );
}
