"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck, UserRoundCog, UserRoundSearch } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  fetchEmployeeControl,
  fetchSecurityOverview,
  fetchUsers,
  resetUserPassword,
  unlockUserAccount,
  updateAdminUser
} from "@/lib/api";
import { SectionCard } from "@/components/section-card";
import type { EmployeeControlProfile, SecurityOverview, UserProfile, UserRole } from "@/types/erp";

const roles: UserRole[] = ["ADMIN", "MANAGER", "EMPLOYEE"];
const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

type AdminDraft = {
  role: UserRole;
  title: string;
  department: string;
  status: "ACTIVE" | "SUSPENDED";
  mustRotatePassword: boolean;
};

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function buildDraft(user: UserProfile): AdminDraft {
  return {
    role: user.role,
    title: user.title,
    department: user.department,
    status: user.status,
    mustRotatePassword: user.mustRotatePassword
  };
}

export function AdminUsersPanel() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<EmployeeControlProfile | null>(null);
  const [draft, setDraft] = useState<AdminDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedUser = useMemo(
    () => users.find((entry) => entry.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  async function loadUsersAndSecurity() {
    if (!token || user?.role !== "ADMIN") {
      return;
    }

    const [usersPayload, securityPayload] = await Promise.all([fetchUsers(token), fetchSecurityOverview(token)]);
    setUsers(usersPayload);
    setSecurityOverview(securityPayload);
    setSelectedUserId((current) => current ?? usersPayload[0]?.id ?? null);
  }

  async function loadSelectedProfile(userId: string) {
    if (!token) {
      return;
    }

    const profile = await fetchEmployeeControl(token, userId);
    setSelectedProfile(profile);
    setDraft(buildDraft(profile.user));
  }

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") {
      return;
    }

    let active = true;

    void (async () => {
      try {
        await loadUsersAndSecurity();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load admin controls.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token, user?.role]);

  useEffect(() => {
    if (!selectedUserId || !token || user?.role !== "ADMIN") {
      return;
    }

    void loadSelectedProfile(selectedUserId).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Unable to load employee control profile.");
    });
  }, [selectedUserId, token, user?.role]);

  async function refreshAll(nextUserId?: string) {
    await loadUsersAndSecurity();
    const userId = nextUserId ?? selectedUserId;
    if (userId) {
      await loadSelectedProfile(userId);
    }
  }

  async function handleSaveControls() {
    if (!token || !selectedUserId || !draft) {
      return;
    }

    setSaving(true);
    setError(null);
    setTemporaryPassword(null);

    try {
      const updatedUser = await updateAdminUser(token, selectedUserId, draft);
      setUsers((current) => current.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry)));
      await refreshAll(selectedUserId);
      setMessage("Admin controls saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update employee controls.");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!token || !selectedUserId) {
      return;
    }

    setSaving(true);
    setError(null);
    setTemporaryPassword(null);

    try {
      const payload = await resetUserPassword(token, selectedUserId, passwordDraft.trim() || undefined);
      setTemporaryPassword(payload.temporaryPassword);
      setPasswordDraft("");
      setUsers((current) => current.map((entry) => (entry.id === payload.user.id ? payload.user : entry)));
      await refreshAll(selectedUserId);
      setMessage("Temporary password generated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reset password.");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlockAccount() {
    if (!token || !selectedUserId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedUser = await unlockUserAccount(token, selectedUserId);
      setUsers((current) => current.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry)));
      await refreshAll(selectedUserId);
      setMessage("Account unlocked and restored.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to unlock account.");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <SectionCard title="Access Restricted" eyebrow="Admin only">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          Only Admin users can manage employee credentials, access control, and activity intelligence.
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/40 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <div className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Identity and governance</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
            Admin employee control center
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Manage employee access, credential posture, activity analysis, and account governance without disturbing the working ERP flows.
          </p>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {temporaryPassword ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Temporary password: <span className="font-semibold text-white">{temporaryPassword}</span>
        </div>
      ) : null}

      {securityOverview ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Locked Accounts", value: String(securityOverview.lockedAccounts), note: "Currently blocked sign-ins" },
            { label: "Suspended", value: String(securityOverview.suspendedAccounts), note: "Accounts paused by admin" },
            { label: "Rotate Password", value: String(securityOverview.rotationRequired), note: "Forced password changes" },
            { label: "Security Risk", value: securityOverview.analysis.overallRisk, note: "AI posture assessment" }
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
              <div className="mt-3 text-2xl font-semibold text-white">{item.value}</div>
              <div className="mt-2 text-sm text-slate-300">{item.note}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="Employee Directory" eyebrow="Select account for control">
          <div className="space-y-3">
            {users.map((entry) => {
              const active = entry.id === selectedUserId;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedUserId(entry.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    active
                      ? "border-primary/40 bg-primary/12"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-white">{entry.name}</div>
                      <div className="mt-1 text-sm text-slate-300">{entry.email}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {entry.role} · {entry.department}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-300">
                      <div>{entry.status}</div>
                      <div className="mt-1">{entry.mustRotatePassword ? "Rotate password" : "Credentials normal"}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {users.length === 0 && !loading ? <div className="text-sm text-slate-400">No users found.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Employee Control" eyebrow="Profile, account, and credentials">
          {selectedUser && draft ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Identity</div>
                  <div className="mt-3 text-lg font-semibold text-white">{selectedUser.name}</div>
                  <div className="mt-1 text-sm text-slate-300">{selectedUser.email}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Account posture</div>
                  <div className="mt-3 text-sm text-slate-200">Status: {selectedUser.status}</div>
                  <div className="mt-1 text-sm text-slate-300">Locked until: {formatDateTime(selectedUser.lockedUntil)}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Security</div>
                  <div className="mt-3 text-sm text-slate-200">Failed logins: {selectedUser.failedLoginAttempts}</div>
                  <div className="mt-1 text-sm text-slate-300">Last login: {formatDateTime(selectedUser.lastLoginAt)}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Lifecycle</div>
                  <div className="mt-3 text-sm text-slate-200">Created: {formatDateTime(selectedUser.createdAt)}</div>
                  <div className="mt-1 text-sm text-slate-300">Password changed: {formatDateTime(selectedUser.lastPasswordChangeAt)}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Role</span>
                  <select
                    value={draft.role}
                    onChange={(event) => setDraft((current) => (current ? { ...current, role: event.target.value as UserRole } : current))}
                    className={inputClassName}
                    disabled={saving}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, status: event.target.value as "ACTIVE" | "SUSPENDED" } : current))
                    }
                    className={inputClassName}
                    disabled={saving}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Title</span>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                    className={inputClassName}
                    disabled={saving}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Department</span>
                  <input
                    value={draft.department}
                    onChange={(event) => setDraft((current) => (current ? { ...current, department: event.target.value } : current))}
                    className={inputClassName}
                    disabled={saving}
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.mustRotatePassword}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, mustRotatePassword: event.target.checked } : current))
                  }
                />
                Force password rotation on next successful sign-in
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Custom temporary password</span>
                <input
                  type="text"
                  value={passwordDraft}
                  onChange={(event) => setPasswordDraft(event.target.value)}
                  className={inputClassName}
                  disabled={saving}
                  placeholder="Leave blank to auto-generate a strong password"
                />
                <span className="mt-2 block text-xs text-slate-400">
                  Admin can set a compliant temporary password or let the system generate one automatically.
                </span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void handleSaveControls()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserRoundCog className="h-4 w-4" />
                  Save employee control
                </button>
                <button
                  onClick={() => void handleResetPassword()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  Reset password
                </button>
                <button
                  onClick={() => void handleUnlockAccount()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Unlock account
                </button>
              </div>

              {selectedProfile?.hrProfile ? (
                <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Linked HR profile</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(selectedProfile.hrProfile).map(([key, value]) => (
                      <div key={key} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{key}</div>
                        <div className="mt-2 text-sm text-slate-200">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-slate-400">Select an employee to manage profile and credentials.</div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <SectionCard title="AI Activity Analysis" eyebrow="Brief, precise employee intelligence">
          {selectedProfile ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                  <UserRoundSearch className="h-4 w-4 text-primary" />
                  Executive summary
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-200">{selectedProfile.analysis.executiveSummary}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: "Risk", value: selectedProfile.analysis.riskLevel },
                  { label: "Activity", value: selectedProfile.analysis.activitySignal },
                  { label: "Security", value: selectedProfile.analysis.securitySignal }
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-white/10 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {selectedProfile.analysis.recommendedActions.map((action) => (
                  <div key={action} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Choose an employee to see AI analysis.</div>
          )}
        </SectionCard>

        <SectionCard title="Employee Activity Timeline" eyebrow="Traceability and audit">
          <div className="space-y-3">
            {selectedProfile?.activity.map((entry) => (
              <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{entry.action}</div>
                    <div className="mt-1 text-sm text-slate-300">{entry.detail}</div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-400">
                    <div>{entry.severity ?? entry.module}</div>
                    <div className="mt-1">{entry.timestamp}</div>
                  </div>
                </div>
              </div>
            ))}
            {selectedProfile && selectedProfile.activity.length === 0 ? (
              <div className="text-sm text-slate-400">No tracked activity for this employee yet.</div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
