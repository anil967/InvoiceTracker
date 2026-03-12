"use client";

import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import AnalyticsDashboard from "@/components/Analytics/AnalyticsDashboard";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import { useEffect } from "react";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const role = getNormalizedRole(user);

  useEffect(() => {
    if (!authLoading && (!user || role !== ROLES.ADMIN)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, role, router]);

  if (authLoading || !user || role !== ROLES.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto h-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
              <Icon name="BarChart2" size={28} />
            </div>
            Analytics & Insights
          </h1>
          <p className="text-gray-500 mt-2 ml-14 max-w-xl">
            Real-time performance metrics and spending analysis across your organization.
          </p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AnalyticsDashboard />
      </motion.div>
    </div>
  );
}