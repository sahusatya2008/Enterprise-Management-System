"use client";

import { useState } from "react";
import { MessageSquareText, Sparkles } from "lucide-react";
import { askCopilot } from "@/lib/api";
import type { CopilotResponse } from "@/types/erp";
import { SectionCard } from "@/components/section-card";

const quickPrompts = [
  "Should we hire more staff this quarter?",
  "What happens if sales drop 20%?",
  "Where can we cut costs without hurting growth?",
  "Which supplier lane needs attention first?",
  "What is the quickest margin action?"
];

export function CopilotPanel() {
  const [question, setQuestion] = useState(quickPrompts[0]);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextQuestion: string) {
    setQuestion(nextQuestion);
    setLoading(true);
    setError(null);

    try {
      const result = await askCopilot(nextQuestion);
      setResponse(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reach the AI copilot.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="AI Business Copilot" eyebrow="Natural-language assistant">
      <div className="space-y-4">
        <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Ask the system</label>
          <div className="flex flex-col gap-3">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white outline-none transition focus:border-primary/40"
            />
            <button
              onClick={() => void submit(question)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Thinking..." : "Generate answer"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void submit(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-primary/30 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="rounded-[26px] border border-white/10 bg-gradient-to-br from-slate-950/55 via-slate-900/35 to-primary/10 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Brief decision answer
          </div>
          <p className="text-sm leading-7 text-slate-200">
            {response?.answer ??
              "Ask about hiring, inventory, margin, security, or sales. The copilot is tuned for concise, context-aware enterprise answers."}
          </p>

          {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          {response?.intent ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Intent: {response.intent}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Confidence: {((response.confidence ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
          ) : null}

          {response?.suggestedFollowUps ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {response.suggestedFollowUps.map((followUp) => (
                <button
                  key={followUp}
                  onClick={() => void submit(followUp)}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  {followUp}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
