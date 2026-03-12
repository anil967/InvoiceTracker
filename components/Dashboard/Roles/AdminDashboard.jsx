"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import Card from "@/components/ui/Card";
import Icon from "@/components/Icon";
import Link from "next/link";
import api from "@/lib/axios";
import { motion, AnimatePresence } from "framer-motion";

const AdminDashboard = ({ invoices = [], onRefresh }) => {
    const [systemHealth, setSystemHealth] = useState({
        dbStatus: 'Checking...',
        apiLatency: '--',
        storageUsage: '--'
    });

    const [recentLogs, setRecentLogs] = useState([]);
    const [userCount, setUserCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [recentInvoicesOpen, setRecentInvoicesOpen] = useState(true);

    // Approval history across system (PM decisions)
    const approvalHistory = (invoices || [])
        .filter(inv => inv.pmApproval?.status === 'APPROVED' || inv.pmApproval?.status === 'REJECTED')
        .sort((a, b) => new Date(b.pmApproval?.approvedAt || b.created_at) - new Date(a.pmApproval?.approvedAt || a.created_at))
        .slice(0, 10);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [logsRes, usersRes, healthRes] = await Promise.all([
                api.get('/api/audit?limit=5'),
                api.get('/api/users'),
                api.get('/api/health')
            ]);
            setRecentLogs(logsRes.data || []);
            setUserCount(usersRes.data?.length || 0);

            // Update health data from API
            if (healthRes.data) {
                setSystemHealth({
                    dbStatus: healthRes.data.dbStatus || 'Unknown',
                    apiLatency: healthRes.data.apiLatency || '0ms',
                    storageUsage: healthRes.data.storageUsage || '0%'
                });
            }
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
            setSystemHealth({
                dbStatus: 'Error',
                apiLatency: 'N/A',
                storageUsage: 'N/A'
            });
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { name: "User Management", icon: "Users", path: "/users", color: "from-blue-500 to-blue-600", desc: "Manage system users" },
        { name: "Rate Cards", icon: "CreditCard", path: "/admin/ratecards", color: "from-indigo-500 to-purple-600", desc: "Manage vendor rates" },
        { name: "Audit Logs", icon: "FileText", path: "/audit", color: "from-teal-500 to-teal-600", desc: "Activity history" },
    ];

    const formatTime = (timestamp) => {
        if (!timestamp) return "Just now";
        const date = new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return "Just now";
        if (diff < 60) return `${diff} mins ago`;
        if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="space-y-8 pb-10 px-4 sm:px-6 lg:px-0">
            {/* System Health - clean cards */}
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 gap-5">
                <Card className="p-6 rounded-2xl border border-emerald-100 dark:border-emerald-700 bg-gradient-linear from-white dark:from-slate-800 to-emerald-50/40 dark:to-emerald-900/40 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Database</p>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 dark:bg-emerald-600 animate-pulse shadow-sm" />
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{systemHealth.dbStatus}</p>
                    </div>
                </Card>
                <Card className="p-6 rounded-2xl border border-violet-100 dark:border-violet-700 bg-gradient-linear from-white dark:from-slate-800 to-violet-50/40 dark:to-violet-900/40 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Users</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{loading ? '…' : userCount}</p>
                </Card>
            </div>

            {/* Recent Invoices - collapsible open/close */}
            <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setRecentInvoicesOpen((o) => !o)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRecentInvoicesOpen((o) => !o); } }}
                    className="w-full p-4 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left border-b border-slate-100 dark:border-slate-600 cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <motion.span
                            animate={{ rotate: recentInvoicesOpen ? 0 : -90 }}
                            transition={{ duration: 0.2 }}
                            className="text-slate-500 dark:text-slate-400"
                        >
                            <Icon name="ChevronDown" size={20} />
                        </motion.span>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent Invoices (Vendor Submissions)</h3>
                        {invoices?.length > 0 && (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-full">
                                {invoices.length}
                            </span>
                        )}
                    </div>
                    {typeof onRefresh === "function" && (
                        <button
                            type="button"
                            onClick={async (e) => {
                                e.stopPropagation();
                                setLoading(true);
                                await onRefresh();
                                setLoading(false);
                            }}
                            disabled={loading}
                            className="text-sm text-primary font-medium hover:underline flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-primary/5 shrink-0 disabled:opacity-50"
                        >
                            <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    )}
                </div>
                <AnimatePresence initial={false}>
                    {recentInvoicesOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="divide-y divide-slate-100 dark:divide-slate-600 max-h-64 overflow-y-auto custom-scrollbar">
                                {!invoices || invoices.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No invoices yet. Vendor submissions will appear here.</div>
                                ) : (
                                    invoices.slice(0, 10).map((inv) => (
                                        <Link
                                            key={inv.id}
                                            href={
                                                inv.status === 'VALIDATION_REQUIRED' ? `/digitization/${inv.id}` :
                                                    `/approvals/${inv.id}`
                                            }
                                            className="p-4 flex justify-between items-center hover:bg-slate-50/80 dark:hover:bg-slate-750/80 transition-colors gap-4"
                                        >
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                    <Icon name="FileText" size={20} />
                                                </div>
                                                <div className="min-w-0 space-y-0.5">
                                                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                                        {inv.vendorName || inv.originalName || inv.id}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                        {inv.vendorCode && (
                                                            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-300">
                                                                {inv.vendorCode}
                                                            </span>
                                                        )}
                                                        {inv.vendorCode && <span className="text-slate-300">•</span>}
                                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                            {(inv.status || '').replace(/_/g, ' ') || 'PENDING'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {inv.amount != null ? `₹ ${Number(inv.amount).toLocaleString()}` : "—"}
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                                    {inv.receivedAt ? new Date(inv.receivedAt).toLocaleDateString() : "—"}
                                                </p>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                            {invoices?.length > 10 && (
                                <div className="p-3 border-t border-slate-100 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                                    <Link href="/approvals" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                                        View all invoices <Icon name="ArrowRight" size={14} />
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 px-1">Quick Actions</h2>
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {quickActions.map((action) => (
                        <Link key={action.path} href={action.path}>
                            <Card className="p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-600 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group shadow-sm h-full flex flex-col items-center sm:items-start text-center sm:text-left">
                                <div className={clsx(
                                    "w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-r flex items-center justify-center mb-3 sm:mb-4 shadow-md group-hover:scale-105 transition-transform shrink-0",
                                    action.name === 'User Management' ? 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700' :
                                    action.name === 'Rate Cards' ? 'from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700' :
                                    'from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700'
                                )}>
                                    <Icon name={action.icon} size={20} className="text-white sm:hidden" />
                                    <Icon name={action.icon} size={24} className="text-white hidden sm:block" />
                                </div>
                                <h3 className="font-bold text-xs sm:text-base text-slate-900 dark:text-slate-100 leading-tight">{action.name}</h3>
                                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 hidden sm:block">{action.desc}</p>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">System Configuration</h3>
                        <Link href="/config" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                            <Icon name="Settings" size={14} /> Edit
                        </Link>
                    </div>
                    <div className="p-5 space-y-4">

                        <div className="flex justify-between items-center text-sm py-1">
                            <span className="text-slate-600">OCR Engine</span>
                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1">
                            <span className="text-slate-600">Audit Retention</span>
                            <span className="font-mono bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-semibold">7 Years</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1">
                            <span className="text-slate-600">SAP Integration</span>
                            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-300 font-medium text-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-600" /> Disconnected
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Approval History */}
                <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Approval History</h3>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                {approvalHistory.length} Recent PM Decisions
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-600">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Invoice</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vendor</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden sm:table-cell">Assigned PM</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Decision</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right hidden md:table-cell">By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                                {approvalHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                                            No decisions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    approvalHistory.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/50 transition-colors">
                                            <td className="px-4 py-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {inv.invoiceNumber || `#${inv.id.slice(-6)}`}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-300 truncate">
                                                        {inv.vendorCode || inv.vendorId || '—'}
                                                    </span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-semibold text-[10px] sm:text-xs truncate">
                                                        {inv.vendorName || 'Unknown Vendor'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell truncate">
                                                {inv.assignedPMName || inv.assignedPM || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest
                                                    ${inv.pmApproval?.status === 'APPROVED'
                                                        ? 'bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700'
                                                        : 'bg-rose-50 dark:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-700'
                                                    }`}>
                                                    {inv.pmApproval?.status?.slice(0, 3) || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-[10px] text-slate-500 hidden md:table-cell">
                                                {inv.pmApprovedByName || 'System'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent System Activity</h3>
                        <Link href="/audit" className="text-sm text-primary font-medium hover:underline">View All</Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Loading…</div>
                        ) : recentLogs.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No recent activity</div>
                        ) : (
                            recentLogs.map((log, idx) => (
                                <div key={log._id || idx} className="p-4 flex justify-between items-center hover:bg-slate-50/50 dark:hover:bg-slate-750/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-linear from-slate-100 dark:from-slate-900 to-slate-200 dark:to-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                            {log.username?.charAt(0) || "S"}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{log.username || "System"}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{log.action}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime(log.timestamp)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;
