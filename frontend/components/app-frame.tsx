"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import type { UserRole } from "@/types/erp";

const authRoutes = new Set(["/login", "/register"]);
const routePermissions: Record<string, UserRole[]> = {
  "/finance": ["ADMIN", "MANAGER"],
  "/admin": ["ADMIN"],
  "/admin/security": ["ADMIN"]
};

function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aurora px-6 text-slate-100">
      <div className="rounded-[32px] border border-white/10 bg-slate-950/45 p-8 shadow-ambient backdrop-blur-xl">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Northstar ERP</div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold">Loading workspace</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
          Preparing your role-based enterprise workspace, permissions, and operational dashboards.
        </p>
      </div>
    </div>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user } = useAuth();
  const isAuthRoute = authRoutes.has(pathname);
  const allowedRoles = routePermissions[pathname];

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && !isAuthRoute) {
      router.replace("/login");
      return;
    }

    if (user && isAuthRoute) {
      router.replace("/");
    }
  }, [isAuthRoute, loading, pathname, router, user]);

  if (loading) {
    return <SplashScreen />;
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!user) {
    return <SplashScreen />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <DashboardShell>
        <div className="rounded-[32px] border border-white/10 bg-slate-950/45 p-8 shadow-ambient backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Access denied</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold">Role restriction</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Your current role does not have access to this area. Contact an administrator if you need expanded ERP permissions.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
