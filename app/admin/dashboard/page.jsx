"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import { getAdminDashboardData } from "@/lib/api";
import PageHeader from "@/components/Layout/PageHeader";
import AdminDashboard from "@/components/Dashboard/Roles/AdminDashboard";
import RoleSwitcher from "@/components/Dashboard/RoleSwitcher";
import Icon from "@/components/Icon";

export default function AdminDashboardPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && (!user || role !== ROLES.ADMIN)) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getAdminDashboardData();
            setInvoices(data?.invoices || []);
        } catch (e) {
            console.error("Admin Dashboard fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && role === ROLES.ADMIN) {
            fetchData();
        }
    }, [user, authLoading]);

    if (authLoading || !user || getNormalizedRole(user) !== ROLES.ADMIN) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    const actions = (
        <div className="flex items-center gap-3">
            <RoleSwitcher />
            <button
                onClick={fetchData}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                title="Refresh data"
            >
                <Icon name="RefreshCw" size={18} className={loading ? "animate-spin" : ""} />
            </button>
        </div>
    );

    return (
        <div className="pb-10">
            <PageHeader
                title="Admin Control Center"
                subtitle="System administration & governance"
                icon="Shield"
                accent="purple"
                actions={actions}
            />

            <AdminDashboard invoices={invoices} onRefresh={fetchData} />
        </div>
    );
}
