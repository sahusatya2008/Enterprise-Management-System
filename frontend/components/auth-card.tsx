"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type Mode = "login" | "register";

export function AuthCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    title: "",
    department: ""
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result =
      mode === "login"
        ? await login(form.email, form.password)
        : await register({
            name: form.name,
            email: form.email,
            password: form.password,
            title: form.title,
            department: form.department
          });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? "Unable to continue.");
      return;
    }

    router.replace("/");
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <div className="min-h-screen bg-aurora px-4 py-10 text-slate-100 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <section className="rounded-[34px] border border-white/10 bg-slate-950/45 p-8 shadow-ambient backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
            {mode === "login" ? <LockKeyhole className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {mode === "login" ? "Secure sign in" : "Create account"}
          </div>

          <h1 className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
            {mode === "login" ? "Access your ERP workspace" : "Register your enterprise account"}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            {mode === "login"
              ? "Sign in with your ERP credentials to access dashboards, workflows, and the role-specific control plane."
              : "New registrations start as Employee accounts. Admins can later assign Manager or Admin permissions from the control panel."}
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              { label: "Admin", value: "Full platform governance" },
              { label: "Manager", value: "Department ownership" },
              { label: "Employee", value: "Daily execution access" }
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-sm text-slate-200">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-white/10 bg-slate-950/55 p-8 shadow-ambient backdrop-blur-xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Full name</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-primary/40"
                    placeholder="Avery Morgan"
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Job title</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateField("title", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-primary/40"
                      placeholder="Operations Analyst"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Department</span>
                    <input
                      value={form.department}
                      onChange={(event) => updateField("department", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-primary/40"
                      placeholder="Operations"
                    />
                  </label>
                </div>
              </>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-primary/40"
                placeholder="you@company.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-primary/40"
                placeholder="Enter a secure password"
                required
              />
            </label>

            {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-sm text-slate-300">
            {mode === "login" ? "Need a new account?" : "Already have an account?"}{" "}
            <Link
              href={mode === "login" ? "/register" : "/login"}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-4"
            >
              {mode === "login" ? "Register here" : "Sign in here"}
            </Link>
          </p>

          {mode === "register" ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              New passwords must use at least 12 characters with upper-case, lower-case, numbers, and special symbols.
            </div>
          ) : null}

          {mode === "login" ? (
            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Demo access</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div>`admin@northstar.com` / `password123`</div>
                <div>`manager@northstar.com` / `password123`</div>
                <div>`employee@northstar.com` / `password123`</div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
