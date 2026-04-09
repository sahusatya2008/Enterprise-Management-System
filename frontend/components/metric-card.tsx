import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  accent,
  icon
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5 shadow-ambient backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <div className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">{value}</div>
          <p className="mt-3 text-sm text-slate-300">{hint}</p>
        </div>
        <div className={`rounded-2xl border border-white/10 p-3 text-slate-50 ${accent ?? "bg-white/5"}`}>{icon}</div>
      </div>
    </div>
  );
}

