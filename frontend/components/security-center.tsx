"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { fetchSecurityOverview } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import type { SecurityOverview } from "@/types/erp";

export function SecurityCenter() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") {
      return;
    }

    void fetchSecurityOverview(token)
      .then((payload) => setOverview(payload))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load security overview."));
  }, [token, user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <SectionCard title="Access Restricted" eyebrow="Admin only">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          Only Admin users can open the security center.
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/40 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Security center</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
          Access, audit, and credential posture
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          Review the current security state across lockouts, password rotation, privileged access, and warning-grade audit events.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Overall Risk", value: overview.analysis.overallRisk },
              { label: "Locked", value: String(overview.lockedAccounts) },
              { label: "Suspended", value: String(overview.suspendedAccounts) },
              { label: "Rotation Required", value: String(overview.rotationRequired) },
              { label: "Privileged Admins", value: String(overview.adminCount) }
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-2xl font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <SectionCard title="AI Security Summary" eyebrow="Posture review">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Security intelligence
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-200">{overview.analysis.summary}</p>
              </div>

              <div className="mt-4 space-y-2">
                {overview.analysis.findings.map((finding) => (
                  <div key={finding} className="rounded-[18px] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                    {finding}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {overview.analysis.recommendations.map((recommendation) => (
                  <div key={recommendation} className="rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {recommendation}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Recent Warning Events" eyebrow="Audit anomalies">
              <div className="space-y-3">
                {overview.recentWarnings.map((warning) => (
                  <div key={warning.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{warning.action}</div>
                        <div className="mt-1 text-sm text-slate-300">{warning.detail}</div>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-400">
                        <div>{warning.severity ?? "info"}</div>
                        <div className="mt-1">{warning.timestamp}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {overview.recentWarnings.length === 0 ? <div className="text-sm text-slate-400">No warning-grade events recorded recently.</div> : null}
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
