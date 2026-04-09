"use client";

import { type FormEvent, useEffect, useState } from "react";
import { changePassword, fetchRecentActivity } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import type { AuditLogEntry } from "@/types/erp";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

export function AccountConsole() {
  const { token, user, refreshUser } = useAuth();
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    nextPassword: ""
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchRecentActivity(token)
      .then((payload) => setActivity(payload))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load account activity."));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await changePassword(form, token);
      setMessage(payload.message);
      setForm({
        currentPassword: "",
        nextPassword: ""
      });
      await refreshUser();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/40 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Account center</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
          Profile and credential controls
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          Review your profile, recent account activity, and rotate credentials using the enterprise security policy.
        </p>
      </section>

      {user ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Role", value: user.role, note: "Current workspace permission" },
            { label: "Account", value: user.status, note: "Admin access status" },
            { label: "Password", value: user.mustRotatePassword ? "Rotation required" : "Healthy", note: "Credential posture" },
            { label: "Last login", value: formatDateTime(user.lastLoginAt), note: "Most recent sign-in" },
            { label: "Failed logins", value: String(user.failedLoginAttempts), note: "Recent credential friction" },
            { label: "Password change", value: formatDateTime(user.lastPasswordChangeAt), note: "Last password rotation" }
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
              <div className="mt-3 text-lg font-semibold text-white">{item.value}</div>
              <div className="mt-2 text-sm text-slate-300">{item.note}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <SectionCard title="Change Password" eyebrow="Security policy">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Current password</span>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
                className={inputClassName}
                disabled={saving}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">New password</span>
              <input
                type="password"
                value={form.nextPassword}
                onChange={(event) => setForm((current) => ({ ...current, nextPassword: event.target.value }))}
                className={inputClassName}
                disabled={saving}
                required
              />
            </label>

            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Use at least 12 characters including upper-case, lower-case, numbers, and special symbols.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update password"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Recent Activity" eyebrow="Personal audit trail">
          <div className="space-y-3">
            {activity.map((entry) => (
              <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{entry.action}</div>
                    <div className="mt-1 text-sm text-slate-300">{entry.detail}</div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-400">
                    <div>{entry.module}</div>
                    <div className="mt-1">{entry.timestamp}</div>
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 ? <div className="text-sm text-slate-400">No personal activity entries yet.</div> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
