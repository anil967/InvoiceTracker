"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";

/**
 * Central Dashboard Router
 * Dynamically redirects users to their role-specific dashboard endpoints.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const role = getNormalizedRole(user);

    switch (role) {
      case ROLES.ADMIN:
        router.replace("/admin/dashboard");
        break;
      case ROLES.FINANCE_USER:
        router.replace("/finance/dashboard");
        break;
      case ROLES.PROJECT_MANAGER:
        router.replace("/pm/dashboard");
        break;
      case ROLES.DEPT_HEAD:
        router.replace("/dept-head/dashboard");
        break;
      case ROLES.DIV_HEAD:
        router.replace("/div-head/dashboard");
        break;
      case ROLES.VENDOR:
        router.replace("/vendors");
        break;
      default:
        // Fallback for unknown roles or if role is missing
        router.replace("/login");
        break;
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC]/50 backdrop-blur-sm">
      <div className="text-center">
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <span className="loading loading-spinner loading-lg text-primary relative z-10 w-12 h-12"></span>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">
          Routing to your workspace...
        </p>
      </div>
    </div>
  );
}
