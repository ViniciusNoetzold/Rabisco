import type { ReactNode } from 'react';

export type RunAction = (action: () => void | Promise<void> | undefined) => void;

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <img className={`icon ${className}`} src={`/icons/${name}.png`} alt="" draggable={false} />
  );
}
export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand ${large ? 'brand-large' : ''}`}>
      <img src="/favicon.svg" alt="" />
      <span>
        rabisco<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function RibbonGroup({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ribbon-group ${className}`} aria-label={title}>
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{title}</div>
    </section>
  );
}
