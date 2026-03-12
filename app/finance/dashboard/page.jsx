'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { ROLES, getNormalizedRole } from '@/constants/roles';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/Layout/PageHeader';

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    })
};

const STATUS_STYLES = {
    APPROVED: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
    VERIFIED: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
    PAID: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
    PM_APPROVED: { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500 dark:bg-teal-400' },
    manually_submitted: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500 dark:bg-emerald-400' },
    REJECTED: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500 dark:bg-rose-400' },
    MATCH_DISCREPANCY: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500 dark:bg-amber-400' },
    VALIDATION_REQUIRED: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500 dark:bg-sky-400' },
    PENDING: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500 dark:bg-violet-400' },
    RECEIVED: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400 dark:bg-slate-500' },
};
const getStatus = (s) => STATUS_STYLES[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

export default function FinanceDashboardPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [allInvoices, setAllInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tableOpen, setTableOpen] = useState(true);

    const role = getNormalizedRole(user);

    useEffect(() => {
        if (!authLoading && (!user || (role !== ROLES.FINANCE_USER && role !== ROLES.ADMIN))) {
            router.push("/dashboard");
        }
    }, [user, authLoading, role, router]);

    useEffect(() => {
        if (!authLoading && (role === ROLES.FINANCE_USER || role === ROLES.ADMIN)) {
            fetchInvoices();
        }
    }, [user, authLoading, role]);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/invoices?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setAllInvoices(Array.isArray(data) ? data : (data.invoices || []));
        } catch (err) {
            console.error('Fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Use all invoices - API already filters based on user role (assigned + finance queue + history)
    const invoices = allInvoices;

    // Pending = invoices where finance has NOT yet approved or rejected
    const FINAL_FINANCE_STATUSES = ['APPROVED', 'REJECTED'];
    const pendingApprovals = invoices.filter(inv =>
        !FINAL_FINANCE_STATUSES.includes(inv.financeApproval?.status)
    ).length;

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const thisMonthSpend = invoices.filter(inv => {
        const d = new Date(inv.date || inv.created_at); const n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const processedThisWeek = invoices.filter(inv =>
        new Date(inv.created_at) > weekAgo && FINAL_FINANCE_STATUSES.includes(inv.financeApproval?.status)
    ).length;

    const discrepancyCount = invoices.filter(inv => inv.status === 'MATCH_DISCREPANCY').length;
    const approvedCount = invoices.filter(inv =>
        inv.financeApproval?.status === 'APPROVED' || inv.status === 'APPROVED' ||
        inv.status === 'PM_APPROVED' || inv.status === 'PAID' || inv.status === 'Pending PM Approval'
    ).length;

    // Sort invoices by date descending for recent activity
    const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
        .slice(0, 10);

    const statCards = [
        {
            label: 'Pending Approvals', value: pendingApprovals,
            subtitle: 'Awaiting finance review', icon: 'Clock',
            border: 'border-indigo-200', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
            link: '/finance/approval-queue'
        },
        {
            label: 'MTD Spend', value: `₹${thisMonthSpend.toLocaleString('en-IN')}`,
            subtitle: 'Month-to-date total', icon: 'IndianRupee',
            border: 'border-emerald-200', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
            link: null, isAmount: true
        },
        {
            label: 'Processed', value: processedThisWeek,
            subtitle: 'Processed this week', icon: 'TrendingUp',
            border: 'border-violet-200', iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
            link: '/digitization'
        },
        {
            label: 'Discrepancies', value: discrepancyCount,
            subtitle: 'Need resolution', icon: 'AlertTriangle',
            border: 'border-amber-200', iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
            urgent: discrepancyCount > 0
        }
    ];

    const quickActions = [
        {
            label: 'Approval Queue', icon: 'CheckCircle2', desc: 'Review pending invoices', link: '/finance/approval-queue',
            iconClasses: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
        }
    ];

    return (
        <div className="space-y-6 sm:space-y-8 pb-10">
            {/* Page Header with Signout - using PageHeader component like vendors page */}
            <PageHeader
                title="Finance Dashboard"
                subtitle="Overview of invoice processing and approvals"
                icon="BarChart3"
                accent="indigo"
                roleLabel="Finance User"
            />

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium">
                    <Icon name="AlertCircle" size={18} />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center">
                        <Icon name="X" size={14} />
                    </button>
                </div>
            )}

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {statCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp}
                    >
                        <Link href={card.link || '#'}>
                            <div className={`relative rounded-2xl p-4 sm:p-5 bg-white border ${card.border} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group`}>
                                <div className="flex items-start justify-between mb-3">
                                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                                        {card.label}
                                    </p>
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}>
                                        <Icon name={card.icon} size={16} />
                                    </div>
                                </div>
                                <p className={`${card.isAmount ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'} font-black text-slate-800 tracking-tight`}>
                                    {loading ? '...' : card.value}
                                </p>
                                <p className="text-[10px] sm:text-xs font-medium text-slate-400 mt-1">{card.subtitle}</p>

                                {card.urgent && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                )}
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* ── Quick Actions ── */}
            <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.link}>
                            <div className="group rounded-xl p-4 bg-white border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors",
                                    action.label === 'Approval Queue' ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white' :
                                        'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                )}>
                                    <Icon name={action.icon} size={20} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">{action.label}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{action.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* ── Main Content ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">

                {/* Invoice Table */}
                <div className="xl:col-span-2">
                    <motion.div custom={5} initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                            {/* Header */}
                            <div
                                role="button" tabIndex={0}
                                onClick={() => setTableOpen(o => !o)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTableOpen(o => !o); } }}
                                className="p-4 sm:p-5 flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 transition-colors border-b border-slate-100 cursor-pointer"
                            >
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <motion.span animate={{ rotate: tableOpen ? 0 : -90 }} transition={{ duration: 0.2 }} className="text-slate-400">
                                        <Icon name="ChevronDown" size={16} />
                                    </motion.span>
                                    <h3 className="font-bold text-sm sm:text-base text-slate-800">Recent Invoice Activity</h3>
                                    {invoices.length > 0 && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">{invoices.length}</span>
                                    )}
                                </div>
                                <span className="hidden sm:inline text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                    {tableOpen ? 'Collapse' : 'Expand'}
                                </span>
                            </div>

                            <AnimatePresence>
                                {tableOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                    >
                                        {/* Desktop Table */}
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-[10px] text-slate-400 uppercase tracking-widest bg-white">
                                                        <th className="font-bold py-3 pl-5 text-left">Invoice / Vendor</th>
                                                        <th className="font-bold py-3 text-left">Amount</th>
                                                        <th className="font-bold py-3 text-left">Date</th>
                                                        <th className="font-bold py-3 text-left">Status</th>
                                                        <th className="font-bold py-3 pr-5 text-left">PM Approval</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loading ? (
                                                        <tr>
                                                            <td colSpan={5} className="py-16 text-center">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                                                    <p className="text-xs text-slate-400 font-medium">Loading invoices...</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : recentInvoices.length > 0 ? (
                                                        recentInvoices.map((inv) => {
                                                            const sc = getStatus(inv.status);
                                                            const pmSc = inv.pmApproval?.status === 'APPROVED'
                                                                ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
                                                                : inv.pmApproval?.status === 'REJECTED'
                                                                    ? { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' }
                                                                    : { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };
                                                            return (
                                                                <tr key={inv.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                                    <td className="pl-5 py-3.5">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 rounded-xl bg-linear-to-r from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center font-bold text-indigo-600 text-[10px] shrink-0">
                                                                                {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="font-bold text-slate-800 text-sm truncate">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                                    {inv.vendorCode && <span className="font-mono text-indigo-500 font-semibold">{inv.vendorCode}</span>}
                                                                                    {inv.vendorCode && ' · '}{inv.vendorName || 'Unknown'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-sm font-bold text-slate-700">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</td>
                                                                    <td className="text-xs text-slate-400">{inv.date || '—'}</td>
                                                                    <td>
                                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${sc.bg} ${sc.text}`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                                            {inv.status?.replace(/_/g, ' ')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="pr-5">
                                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${pmSc.bg} ${pmSc.text}`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${pmSc.dot}`} />
                                                                            {inv.pmApproval?.status || 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={5} className="py-16 text-center">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                                        <Icon name="Inbox" size={24} className="text-slate-300" />
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-400">No recent activity</p>
                                                                    <p className="text-xs text-slate-300">Invoices will appear here when submitted</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Cards */}
                                        <div className="sm:hidden divide-y divide-slate-50">
                                            {loading ? (
                                                <div className="py-12 text-center">
                                                    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                                                    <p className="text-xs text-slate-400">Loading...</p>
                                                </div>
                                            ) : recentInvoices.length > 0 ? (
                                                recentInvoices.map((inv) => {
                                                    const sc = getStatus(inv.status);
                                                    return (
                                                        <div key={inv.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100/50 flex items-center justify-center font-bold text-indigo-600 text-[9px] shrink-0">
                                                                        {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 text-sm truncate">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                                                                        <p className="text-[10px] text-slate-400 truncate">{inv.vendorName || 'Unknown'}</p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm font-bold text-slate-700 shrink-0">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2 pl-11">
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
                                                                    <span className={`w-1 h-1 rounded-full ${sc.dot}`} />{inv.status?.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-[10px] text-slate-300">{inv.date || '—'}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="py-12 text-center">
                                                    <Icon name="Inbox" size={24} className="text-slate-200 mx-auto mb-2" />
                                                    <p className="text-sm text-slate-400">No invoices found</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Right: Pipeline Summary */}
                <div className="space-y-4 sm:space-y-5">
                    <motion.div custom={6} initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Pipeline Overview</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Total Invoices', value: invoices.length, icon: 'FileStack', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
                                    { label: 'Approved / Paid', value: approvedCount, icon: 'BadgeCheck', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                                    { label: 'Pending Actions', value: pendingApprovals + discrepancyCount, icon: 'Clock', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
                                    { label: 'Total Value', value: `₹${totalAmount.toLocaleString('en-IN')}`, icon: 'Wallet', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center`}>
                                                <Icon name={item.icon} size={14} />
                                            </div>
                                            <p className="text-xs font-medium text-slate-500">{item.label}</p>
                                        </div>
                                        <p className="text-sm font-black text-slate-800">{loading ? '...' : item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Status Breakdown */}
                    <motion.div custom={7} initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Status Breakdown</h3>
                            <div className="space-y-2">
                                {(() => {
                                    const statusGroups = {};
                                    invoices.forEach(inv => {
                                        statusGroups[inv.status] = (statusGroups[inv.status] || 0) + 1;
                                    });
                                    return Object.entries(statusGroups)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([status, count]) => {
                                            const sc = getStatus(status);
                                            const pct = invoices.length > 0 ? (count / invoices.length) * 100 : 0;
                                            return (
                                                <div key={status} className="group">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${sc.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                            {status.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">{count}</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                        <div className={`h-full rounded-full ${sc.dot} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        });
                                })()}
                                {invoices.length === 0 && !loading && (
                                    <p className="text-xs text-slate-300 text-center py-4">No data yet</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
