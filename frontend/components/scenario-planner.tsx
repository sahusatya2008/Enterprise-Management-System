"use client";

import { useEffect, useState } from "react";
import { WandSparkles } from "lucide-react";
import { simulateScenario } from "@/lib/api";
import { formatCrore } from "@/lib/format";
import type { ScenarioInput, ScenarioResponse } from "@/types/erp";
import { SectionCard } from "@/components/section-card";

const initialScenario: ScenarioInput = {
  salesDelta: 12,
  hiringDelta: 6,
  spendDelta: 3
};

export function ScenarioPlanner() {
  const [scenario, setScenario] = useState<ScenarioInput>(initialScenario);
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void runSimulation(initialScenario);
  }, []);

  async function runSimulation(nextScenario: ScenarioInput) {
    setLoading(true);
    const simulation = await simulateScenario(nextScenario);
    setResult(simulation);
    setLoading(false);
  }

  function update<K extends keyof ScenarioInput>(key: K, value: number) {
    setScenario((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <SectionCard title="Scenario Planner" eyebrow="What-if simulation">
      <div className="grid gap-6 lg:grid-cols-[1fr,0.95fr]">
        <div className="space-y-5">
          {([
            { key: "salesDelta", label: "Sales change", suffix: "%" },
            { key: "hiringDelta", label: "Hiring change", suffix: "%" },
            { key: "spendDelta", label: "Spend change", suffix: "%" }
          ] as const).map(({ key, label, suffix }) => (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span>{label}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white">
                  {scenario[key]}
                  {suffix}
                </span>
              </div>
              <input
                type="range"
                min={-25}
                max={25}
                value={scenario[key]}
                onChange={(event) => update(key, Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-teal-300"
              />
            </div>
          ))}

          <button
            onClick={() => void runSimulation(scenario)}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            <WandSparkles className="h-4 w-4" />
            {loading ? "Simulating..." : "Run simulation"}
          </button>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Projected revenue</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCrore(result.projectedRevenue)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Projected margin</div>
                  <div className="mt-2 text-2xl font-semibold">{result.projectedMargin}%</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sales forecast</div>
                  <div className="mt-2 text-2xl font-semibold">{formatCrore(result.projectedSalesForecast)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Projected headcount</div>
                  <div className="mt-2 text-2xl font-semibold">{result.projectedHeadcount}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/5 to-transparent p-4 text-sm leading-6 text-slate-200">
                {result.recommendation}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-300">Running the first scenario...</div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
