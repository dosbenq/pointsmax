import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={`pm-glass ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
