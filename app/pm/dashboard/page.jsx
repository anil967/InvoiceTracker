"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import { getPMDashboardData } from "@/lib/api";
import PageHeader from "@/components/Layout/PageHeader";
import ProjectManagerDashboard from "@/components/Dashboard/Roles/ProjectManagerDashboard";
import Icon from "@/components/Icon";

export default function PMDashboardPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && (!user || role !== ROLES.PROJECT_MANAGER)) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getPMDashboardData();
            setInvoices(data?.invoices || []);
        } catch (e) {
            console.error("PM Dashboard fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && role === ROLES.PROJECT_MANAGER) {
            fetchData();
        }
    }, [user, authLoading]);

    if (authLoading || !user || getNormalizedRole(user) !== ROLES.PROJECT_MANAGER) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    const actions = (
        <div className="flex items-center gap-3">
            <button
                onClick={fetchData}
                className="flex items-center gap-2 h-10 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
                <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
                <span>Sync Projects</span>
            </button>
        </div>
    );

    return (
        <div className="pb-10">
            <PageHeader
                title="Project Command"
                subtitle="Assigned Projects Overview"
                icon="Briefcase"
                accent="blue"
                actions={actions}
            />

            <ProjectManagerDashboard
                user={user}
                invoices={invoices}
                filteredInvoices={invoices}
                onUploadComplete={fetchData}
            />
        </div>
    );
}
