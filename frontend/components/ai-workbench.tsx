"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Cpu, LockKeyhole, Radar, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { fetchAiWorkbench } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { CopilotPanel } from "@/components/copilot-panel";
import { SectionCard } from "@/components/section-card";
import type { AiWorkbench } from "@/types/erp";

const toolIcons: Record<string, typeof Sparkles> = {
  "executive-brief": Sparkles,
  "supply-chain": Truck,
  "working-capital": Radar,
  workforce: Cpu,
  revenue: BriefcaseBusiness,
  security: ShieldCheck,
  "supplier-intelligence": Truck,
  "policy-guard": LockKeyhole,
  "anomaly-radar": Radar
};

export function AiWorkbenchPanel() {
  const { token } = useAuth();
  const [workbench, setWorkbench] = useState<AiWorkbench | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchAiWorkbench(token)
      .then((payload) => setWorkbench(payload))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load AI workbench."));
  }, [token]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/40 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">AI workbench</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
          Enterprise AI tools and guidance
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          Use concise AI briefings for executive action, supply chain pressure, working-capital control, workforce decisions, and security awareness.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {workbench ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workbench.tools.map((tool) => {
              const Icon = toolIcons[tool.id] ?? Sparkles;
              return (
                <div key={tool.id} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                  <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">{tool.title}</div>
                  <div className="mt-2 text-sm text-slate-300">{tool.summary}</div>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">{tool.priority} priority</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="space-y-6">
              <SectionCard title="Executive AI Brief" eyebrow="Leadership summary">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm leading-7 text-slate-200">{workbench.executiveBrief.summary}</p>
                  <div className="mt-4 rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {workbench.executiveBrief.recommendation}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {[
                    ["Supply Chain", workbench.supplyChain.summary, workbench.supplyChain.recommendation],
                    ["Working Capital", workbench.workingCapital.summary, workbench.workingCapital.recommendation],
                    ["Workforce", workbench.workforce.summary, workbench.workforce.recommendation],
                    ["Revenue", workbench.revenue.summary, workbench.revenue.recommendation]
                  ].map(([title, summary, recommendation]) => (
                    <div key={title} className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                      <div className="font-semibold text-white">{title}</div>
                      <div className="mt-2 text-sm text-slate-300">{summary}</div>
                      <div className="mt-3 text-sm text-primary">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Enterprise AI Controls" eyebrow="Governance, suppliers, and anomalies">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Security Review", workbench.security.summary, workbench.security.recommendation],
                    ["Supplier Intelligence", workbench.supplierIntelligence.summary, workbench.supplierIntelligence.recommendation],
                    ["Policy Guard", workbench.policyGuard.summary, workbench.policyGuard.recommendation],
                    ["Anomaly Radar", workbench.anomalyRadar.summary, workbench.anomalyRadar.recommendation]
                  ].map(([title, summary, recommendation]) => (
                    <div key={title} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold text-white">{title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{summary}</div>
                      <div className="mt-3 text-sm text-primary">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <CopilotPanel />
          </div>
        </>
      ) : null}
    </div>
  );
}
