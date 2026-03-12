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
import LifecycleProgressTracker from '@/components/Lifecycle/LifecycleProgressTracker';

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    })
};

const STATUS_STYLES = {
    [ROLES.DIVISIONAL_HEAD]: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    APPROVED: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    'Div Head Approved': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    'Pending Dept Head Review': { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
    'Pending Div Head Review': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
    REJECTED: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
    'Dept Head Rejected': { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
    PENDING: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
};
const getStatus = (s) => STATUS_STYLES[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

export default function DeptHeadDashboardPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [allInvoices, setAllInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tableOpen, setTableOpen] = useState(true);

    const role = getNormalizedRole(user);

    useEffect(() => {
        if (!authLoading && (!user || (role !== ROLES.DEPARTMENT_HEAD && role !== ROLES.ADMIN))) {
            router.push('/dashboard');
        }
    }, [user, authLoading, role, router]);

    useEffect(() => {
        if (!authLoading && (role === ROLES.DEPARTMENT_HEAD || role === ROLES.ADMIN)) {
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

    const invoices = allInvoices;

    const FINAL_DEPT_HEAD_STATUSES = ['APPROVED', 'REJECTED'];
    const pendingApprovals = invoices.filter(inv =>
        !FINAL_DEPT_HEAD_STATUSES.includes(inv.deptHeadApproval?.status)
    ).length;

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const thisMonthSpend = invoices.filter(inv => {
        const d = new Date(inv.date || inv.created_at); const n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const processedThisWeek = invoices.filter(inv =>
        new Date(inv.created_at) > weekAgo && FINAL_DEPT_HEAD_STATUSES.includes(inv.deptHeadApproval?.status)
    ).length;

    const approvedCount = invoices.filter(inv =>
        inv.deptHeadApproval?.status === 'APPROVED' || inv.status === 'Div Head Approved'
    ).length;

    const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
        .slice(0, 10);

    const statCards = [
        {
            label: 'Pending Approvals', value: pendingApprovals,
            subtitle: 'Awaiting your review', icon: 'Clock',
            border: 'border-teal-200', iconBg: 'bg-teal-50', iconColor: 'text-teal-600',
            link: '/dept-head/approval-queue'
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
            link: null
        },
        {
            label: 'Forwarded to Div Head', value: approvedCount,
            subtitle: 'Sent for final approval', icon: 'CheckCircle2',
            border: 'border-indigo-200', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
            link: null
        }
    ];

    const quickActions = [
        {
            label: 'Approval Queue', icon: 'CheckCircle2', desc: 'Review pending invoices', link: '/dept-head/approval-queue',
            iconClasses: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
        }
    ];

    return (
        <div className="space-y-6 sm:space-y-8 pb-10">
            <PageHeader
                title="Department Head Dashboard"
                subtitle="Overview of invoice reviews and approvals"
                icon="BarChart3"
                accent="teal"
                roleLabel="Department Head"
            />

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium">
                    <Icon name="AlertCircle" size={18} />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center">
                        <Icon name="X" size={14} />
                    </button>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {statCards.map((card, i) => (
                    <motion.div key={card.label} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                        <Link href={card.link || '#'}>
                            <div className={`relative rounded-2xl p-4 sm:p-5 bg-white border ${card.border} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group`}>
                                <div className="flex items-start justify-between mb-3">
                                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{card.label}</p>
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}>
                                        <Icon name={card.icon} size={16} />
                                    </div>
                                </div>
                                <p className={`${card.isAmount ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'} font-black text-slate-800 tracking-tight`}>
                                    {loading ? '...' : card.value}
                                </p>
                                <p className="text-[10px] sm:text-xs font-medium text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Quick Actions */}
            <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {quickActions.map((action) => (
                        <Link key={action.label} href={action.link}>
                            <div className="group rounded-xl p-4 bg-white border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors", action.iconClasses)}>
                                    <Icon name={action.icon} size={20} />
                                </div>
                                <p className="text-sm font-bold text-slate-700">{action.label}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{action.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
                <div className="xl:col-span-2">
                    <motion.div custom={5} initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
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
                                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                    >
                                        {loading ? (
                                            <div className="flex flex-col items-center gap-3 py-16">
                                                <div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                                                <p className="text-xs text-slate-400 font-medium">Loading invoices...</p>
                                            </div>
                                        ) : recentInvoices.length > 0 ? (
                                            <div className="divide-y divide-slate-50">
                                                {recentInvoices.map((inv) => {
                                                    const sc = getStatus(inv.status);
                                                    const pmSt = inv.pmApproval?.status;
                                                    const pmSc = pmSt === 'APPROVED'
                                                        ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' }
                                                        : pmSt === 'REJECTED'
                                                            ? { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' }
                                                            : pmSt === 'INFO_REQUESTED'
                                                                ? { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Re-check' }
                                                                : { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: pmSt || 'Pending' };
                                                    const fmtDate = (d) => {
                                                        if (!d) return '—';
                                                        const dt = new Date(d);
                                                        return `${dt.getDate()}-${dt.getMonth() + 1}-${dt.getFullYear()}`;
                                                    };
                                                    return (
                                                        <div key={inv.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                {/* Avatar */}
                                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100/50 flex items-center justify-center font-bold text-teal-600 text-[10px] shrink-0">
                                                                    {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                                                </div>
                                                                {/* Invoice + Vendor */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="font-bold text-slate-800 text-sm">{inv.invoiceNumber || inv.id?.slice(0, 10)}</p>
                                                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
                                                                            <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                                                                            {inv.status?.replace(/_/g, ' ')}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                        {inv.vendorCode && <span className="font-mono text-teal-500 font-semibold">{inv.vendorCode}</span>}
                                                                        {inv.vendorCode && ' · '}{inv.vendorName || 'Unknown Vendor'}
                                                                    </p>
                                                                </div>
                                                                {/* Right side: amount + date + pm */}
                                                                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                                                    <p className="text-sm font-black text-slate-800">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</p>
                                                                    <p className="text-[10px] text-slate-400">{fmtDate(inv.date)}</p>
                                                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${pmSc.bg} ${pmSc.text}`}>
                                                                        <span className={`w-1 h-1 rounded-full ${pmSc.dot}`} />
                                                                        PM: {pmSc.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 py-16">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                    <Icon name="Inbox" size={24} className="text-slate-300" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-400">No recent activity</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Pipeline Summary */}
                <div className="space-y-4 sm:space-y-5">
                    <motion.div custom={6} initial="hidden" animate="visible" variants={fadeUp}>
                        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Pipeline Overview</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Total Invoices', value: invoices.length, icon: 'FileStack', iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
                                    { label: 'Forwarded to Div Head', value: approvedCount, icon: 'BadgeCheck', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                                    { label: 'Pending Your Review', value: pendingApprovals, icon: 'Clock', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
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
                </div>
            </div>
        </div>
    );
}
