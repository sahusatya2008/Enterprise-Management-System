import clsx from "clsx";
import type { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  children,
  className
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-[30px] border border-white/10 bg-slate-950/35 p-5 shadow-ambient backdrop-blur-xl", className)}>
      <div className="mb-5">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.26em] text-slate-400">{eyebrow}</p> : null}
        <h3 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

