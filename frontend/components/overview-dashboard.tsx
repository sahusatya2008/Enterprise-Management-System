"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Banknote, Boxes, Users2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchDashboard } from "@/lib/api";
import type { DashboardData } from "@/types/erp";
import { dashboardFallback } from "@/lib/fallback-data";
import { formatCurrency } from "@/lib/format";
import { CopilotPanel } from "@/components/copilot-panel";
import { MetricCard } from "@/components/metric-card";
import { ScenarioPlanner } from "@/components/scenario-planner";
import { SectionCard } from "@/components/section-card";

export function OverviewDashboard() {
  const [data, setData] = useState<DashboardData>(dashboardFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetchDashboard().then((payload) => {
      if (active) {
        setData(payload);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/45 to-primary/10 p-6 shadow-ambient backdrop-blur-xl">
        <div className="grid gap-8 xl:grid-cols-[1.2fr,0.8fr]">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.28em] text-slate-300">
              Executive cockpit
            </div>
            <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight md:text-5xl">
              Unified enterprise control with AI-guided next actions.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Inventory, people, finance, and revenue now operate from a shared decision surface. The system pairs real-time module telemetry with predictive analytics to recommend what to do next.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
                Operating signal: {data.intelligence.operatingSignal}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                Confidence: {(data.intelligence.confidence * 100).toFixed(0)}%
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {loading ? "Syncing data..." : `Updated ${new Date(data.generatedAt).toLocaleString()}`}
              </div>
            </div>
          </div>

            <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue", value: formatCurrency(data.finance.overview.revenue), note: "Current run-rate" },
              { label: "Pipeline", value: formatCurrency(data.sales.overview.pipelineValue), note: "Weighted opportunity value" },
              { label: "Headcount", value: String(data.hr.overview.headcount), note: "Active employees" },
              { label: "Low-stock SKUs", value: String(data.inventory.overview.lowStockItems), note: "Immediate supply risk" }
            ].map((item) => (
              <div key={item.label} className="rounded-[26px] border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-2xl font-semibold">{item.value}</div>
                <div className="mt-2 text-sm text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Growth Index"
          value={`${data.scorecard.growth}`}
          hint="Signals from pipeline velocity and conversion"
          accent="bg-primary/15"
          icon={<ArrowUpRight className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          label="Operations"
          value={`${data.scorecard.operations}`}
          hint="Weighted health of stock, warehouse, and fulfillment"
          accent="bg-cyan-400/15"
          icon={<Boxes className="h-5 w-5 text-cyan-200" />}
        />
        <MetricCard
          label="Finance Health"
          value={`${data.scorecard.financeHealth}`}
          hint="Cash runway, collections, and margin quality"
          accent="bg-amber-400/15"
          icon={<Banknote className="h-5 w-5 text-amber-200" />}
        />
        <MetricCard
          label="Workforce"
          value={`${data.scorecard.workforceHealth}`}
          hint="Attendance, productivity, and attrition signal"
          accent="bg-rose-400/15"
          icon={<Users2 className="h-5 w-5 text-rose-200" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
        <SectionCard title="Revenue, Inventory, and People Pulse" eyebrow="Cross-functional trends">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.sales.orders.map((entry, index) => ({
                  month: entry.month,
                  booked: entry.booked * 100,
                  won: entry.won * 100,
                  stock: data.inventory.forecast[index]?.predicted ?? 0
                }))}
              >
                <defs>
                  <linearGradient id="booked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5eead4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#5eead4" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="stock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(2, 6, 23, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18
                  }}
                />
                <Area type="monotone" dataKey="booked" stroke="#5eead4" fill="url(#booked)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="won" stroke="#38bdf8" fillOpacity={0} strokeWidth={2.2} />
                <Area type="monotone" dataKey="stock" stroke="#f59e0b" fill="url(#stock)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Decision Intelligence" eyebrow="AI-recommended priorities">
          <div className="space-y-3">
            {data.intelligence.insights.map((insight) => (
              <div key={insight.title} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold">{insight.title}</h4>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">
                    {(insight.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{insight.summary}</p>
                <p className="mt-3 text-sm text-white">{insight.impact}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">{insight.owner}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <ScenarioPlanner />
        <CopilotPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
        <SectionCard title="Realtime Alerts" eyebrow="Event-driven notification stream">
          <div className="space-y-3">
            {data.notifications.map((notification) => (
              <div key={notification.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{notification.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{notification.module}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/45 px-2 py-1 text-xs text-slate-200">
                    {notification.severity}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{notification.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Department Momentum" eyebrow="Module KPI comparison">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Inventory", value: data.inventory.overview.fulfillmentRate },
                  { name: "People", value: data.hr.overview.attendanceRate },
                  { name: "Finance", value: data.finance.overview.margin },
                  { name: "Sales", value: data.sales.overview.conversionRate }
                ]}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(2, 6, 23, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18
                  }}
                />
                <Bar dataKey="value" fill="#5eead4" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Audit Timeline" eyebrow="Governance and traceability">
        <div className="grid gap-3 md:grid-cols-2">
          {data.auditLogs.map((entry) => (
            <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                <Activity className="h-4 w-4 text-primary" />
                {entry.action}
              </div>
              <p className="mt-3 text-sm text-white">{entry.detail}</p>
              <div className="mt-2 text-sm text-slate-300">
                {entry.actor} · {entry.module}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
