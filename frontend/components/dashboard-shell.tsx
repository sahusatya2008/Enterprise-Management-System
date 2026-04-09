"use client";

import clsx from "clsx";
import {
  Activity,
  BriefcaseBusiness,
  Boxes,
  IndianRupee,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Users2
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import type { UserRole } from "@/types/erp";

const navigation = [
  { href: "/" as Route, label: "Executive", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/inventory" as Route, label: "Inventory", icon: Boxes, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/people" as Route, label: "People", icon: Users2, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/finance" as Route, label: "Finance", icon: IndianRupee, roles: ["ADMIN", "MANAGER"] as UserRole[] },
  { href: "/sales" as Route, label: "Sales", icon: BriefcaseBusiness, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/ai-center" as Route, label: "AI Center", icon: Sparkles, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/account" as Route, label: "Account", icon: LockKeyhole, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] as UserRole[] },
  { href: "/admin" as Route, label: "Admin", icon: ShieldCheck, roles: ["ADMIN"] as UserRole[] },
  { href: "/admin/security" as Route, label: "Security", icon: ShieldAlert, roles: ["ADMIN"] as UserRole[] }
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const visibleNavigation = navigation.filter((item) => (user ? item.roles.includes(user.role) : false));

  return (
    <div className="min-h-screen bg-aurora text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 md:px-6 lg:px-8">
        <aside className="hidden w-[280px] shrink-0 flex-col justify-between rounded-[32px] border border-white/10 bg-slate-900/45 p-5 shadow-ambient backdrop-blur-xl lg:flex">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                <Activity className="h-3.5 w-3.5" />
                Northstar ERP
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
                  Enterprise command center
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  A web-first operating system for inventory, people, finance, sales, and decision intelligence.
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {visibleNavigation.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
                      active
                        ? "border-primary/40 bg-primary/12 text-white"
                        : "border-white/5 bg-white/5 text-slate-300 hover:border-white/15 hover:bg-white/8"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{label}</span>
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Live</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Decision engine</div>
              <div className="mt-3 text-2xl font-semibold">Rule + ML hybrid</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Cross-module intelligence aligns hiring, stock, spend, and pipeline decisions in one surface.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed in</div>
              <div className="mt-3 text-lg font-semibold">{user?.name}</div>
              <p className="mt-1 text-sm text-slate-300">
                {user?.title} · {user?.role}
              </p>
              <button
                onClick={logout}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-primary/30 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col gap-6">
          <header className="rounded-[28px] border border-white/10 bg-slate-950/35 px-5 py-4 shadow-ambient backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Tenant</p>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">{user?.tenantId ?? "Northstar Holdings"}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
                  Live orchestration
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                  {user?.role ?? "EMPLOYEE"} workspace
                </div>
                <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm text-amber-200">
                  Event-driven alerts
                </div>
              </div>
            </div>
          </header>

          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
