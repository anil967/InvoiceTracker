'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Card from '@/components/ui/Card';
import Icon from '@/components/Icon';
import LifecycleProgressTracker from '@/components/Lifecycle/LifecycleProgressTracker';
import DocumentViewer from '@/components/ui/DocumentViewer';
import { useAuth } from '@/context/AuthContext';
import clsx from 'clsx';

const POLL_INTERVAL = 8000; // 8 seconds

export default function PMApprovalsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading approvals...</div>}>
            <PMApprovalsPageContent />
        </Suspense>
    );
}

function PMApprovalsPageContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();

    const [allInvoices, setAllInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isLive, setIsLive] = useState(true);

    // Filter & search
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Document viewer
    const [viewerInvoiceId, setViewerInvoiceId] = useState(null);
    const [viewerLoading, setViewerLoading] = useState(false);
    const [spreadsheetData, setSpreadsheetData] = useState(null);

    // Polling ref
    const pollRef = useRef(null);
    const prevCountRef = useRef(0);
    const [newActivity, setNewActivity] = useState(false);

    // ── Fetch invoices ──
    const fetchInvoices = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError(null);
            const res = await fetch(`/api/invoices?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to fetch');
            const list = Array.isArray(data) ? data : (data.invoices || []);

            // Detect new activity
            if (prevCountRef.current > 0 && list.length !== prevCountRef.current) {
                setNewActivity(true);
                setTimeout(() => setNewActivity(false), 3000);
            }
            prevCountRef.current = list.length;

            setAllInvoices(list);
            setLastUpdated(new Date());
        } catch (err) {
            if (!silent) setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-poll
    useEffect(() => {
        fetchInvoices();
        if (isLive) {
            pollRef.current = setInterval(() => fetchInvoices(true), POLL_INTERVAL);
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [isLive]);

    // Handle URL-based invoice view
    useEffect(() => {
        const invoiceId = searchParams.get('invoiceId');
        if (invoiceId && allInvoices.length > 0) {
            handleViewDocument(invoiceId);
        }
    }, [searchParams, allInvoices.length]);

    const handleViewDocument = async (id) => {
        setViewerInvoiceId(id);
        setViewerLoading(true);
        setSpreadsheetData(null);

        const inv = allInvoices.find(i => i.id === id);
        if (inv) {
            const fileName = (inv.originalName || "").toLowerCase();
            const isSpreadsheet = fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv');
            if (isSpreadsheet) {
                try {
                    const res = await fetch(`/api/invoices/${id}/preview`);
                    const data = await res.json();
                    if (data.data) setSpreadsheetData(data.data);
                } catch (err) {
                    console.error("Failed to fetch spreadsheet preview:", err);
                }
            }
            setViewerLoading(false);
        }
    };

    // ── Derive workflow status ──
    const getWorkflowStage = (inv) => {
        if (inv.pmApproval?.status === 'APPROVED') return 'completed';
        if (inv.pmApproval?.status === 'REJECTED') return 'pm_rejected';
        if (inv.financeApproval?.status === 'REJECTED') return 'finance_rejected';
        if (inv.financeApproval?.status === 'APPROVED') return 'pm_review';
        if (inv.status === 'RECEIVED' || inv.status === 'DIGITIZING' || inv.status === 'VALIDATION_REQUIRED' || inv.status === 'VERIFIED') return 'processing';
        return 'vendor_submitted';
    };

    const getStageInfo = (stage) => {
        switch (stage) {
            case 'vendor_submitted': return { label: 'Vendor Submitted', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'Upload', dot: 'bg-slate-400' };
            case 'processing': return { label: 'Processing', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'Loader', dot: 'bg-blue-500' };
            case 'pm_review': return { label: 'PM Review', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', icon: 'UserCheck', dot: 'bg-indigo-500' };
            case 'completed': return { label: 'Fully Approved', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: 'CheckCircle2', dot: 'bg-emerald-500' };
            case 'finance_rejected': return { label: 'Finance Rejected', color: 'bg-rose-50 text-rose-600 border-rose-200', icon: 'XCircle', dot: 'bg-rose-500' };
            case 'pm_rejected': return { label: 'PM Rejected', color: 'bg-rose-50 text-rose-600 border-rose-200', icon: 'XCircle', dot: 'bg-rose-500' };
            default: return { label: 'Unknown', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'HelpCircle', dot: 'bg-slate-400' };
        }
    };

    // ── Tab counts ──
    const tabCounts = useMemo(() => {
        const counts = { all: allInvoices.length, pending: 0, finance_done: 0, pm_review: 0, approved: 0, rejected: 0 };
        allInvoices.forEach(inv => {
            const stage = getWorkflowStage(inv);
            if (stage === 'vendor_submitted' || stage === 'processing') counts.pending++;
            if (inv.financeApproval?.status === 'APPROVED') counts.finance_done++;
            if (stage === 'pm_review') counts.pm_review++;
            if (stage === 'completed') counts.approved++;
            if (stage === 'finance_rejected' || stage === 'pm_rejected') counts.rejected++;
        });
        return counts;
    }, [allInvoices]);

    // ── Filtered invoices ──
    const filteredInvoices = useMemo(() => {
        let list = allInvoices;
        switch (activeTab) {
            case 'pending':
                list = list.filter(i => { const s = getWorkflowStage(i); return s === 'vendor_submitted' || s === 'processing'; });
                break;
            case 'finance_done':
                list = list.filter(i => i.financeApproval?.status === 'APPROVED');
                break;
            case 'pm_review':
                list = list.filter(i => getWorkflowStage(i) === 'pm_review');
                break;
            case 'approved':
                list = list.filter(i => getWorkflowStage(i) === 'completed');
                break;
            case 'rejected':
                list = list.filter(i => { const s = getWorkflowStage(i); return s === 'finance_rejected' || s === 'pm_rejected'; });
                break;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(i =>
                (i.invoiceNumber || '').toLowerCase().includes(q) ||
                (i.vendorName || '').toLowerCase().includes(q) ||
                (i.vendorCode || '').toLowerCase().includes(q) ||
                (i.id || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [allInvoices, activeTab, searchQuery]);

    const TAB_COLORS = {
        all: { active: 'bg-slate-100 text-slate-700 border-slate-200', badge: 'bg-slate-200 text-slate-700' },
        pending: { active: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-100 text-amber-700' },
        finance_done: { active: 'bg-blue-50 text-blue-700 border-blue-200', badge: 'bg-blue-100 text-blue-700' },
        pm_review: { active: 'bg-indigo-50 text-indigo-700 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
        approved: { active: 'bg-emerald-50 text-emerald-700 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
        rejected: { active: 'bg-rose-50 text-rose-700 border-rose-200', badge: 'bg-rose-100 text-rose-700' },
    };

    const tabs = [
        { key: 'all', label: 'All', count: tabCounts.all, icon: 'LayoutList' },
        { key: 'pending', label: 'Vendor Stage', count: tabCounts.pending, icon: 'Upload' },
        { key: 'finance_done', label: 'Finance Done', count: tabCounts.finance_done, icon: 'ShieldCheck' },
        { key: 'pm_review', label: 'PM Review', count: tabCounts.pm_review, icon: 'UserCheck' },
        { key: 'approved', label: 'Fully Approved', count: tabCounts.approved, icon: 'CheckCircle2' },
        { key: 'rejected', label: 'Rejected', count: tabCounts.rejected, icon: 'XCircle' },
    ];

    return (
        <div className="pb-10 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Approval Workflow Tracker</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Real-time tracking of invoice approvals across all stages</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Live indicator */}
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={clsx(
                            "inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[11px] font-bold border transition-all",
                            isLive
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : "bg-slate-50 text-slate-400 border-slate-200"
                        )}
                    >
                        <span className={clsx(
                            "w-2 h-2 rounded-full shrink-0",
                            isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                        )} />
                        {isLive ? 'LIVE' : 'PAUSED'}
                    </button>

                    {/* Last updated */}
                    {lastUpdated && (
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}

                    {/* Manual refresh */}
                    <button
                        onClick={() => fetchInvoices(false)}
                        disabled={loading}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                        <Icon name="RefreshCw" size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

            </div>

            {/* New activity flash */}
            <AnimatePresence>
                {newActivity && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold"
                    >
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        New activity detected — data refreshed
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total', value: tabCounts.all, color: 'text-slate-600', bg: 'bg-white' },
                    { label: 'Vendor Stage', value: tabCounts.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Finance Done', value: tabCounts.finance_done, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'PM Review', value: tabCounts.pm_review, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Approved', value: tabCounts.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Rejected', value: tabCounts.rejected, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 p-3 text-center`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Icon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by invoice number, vendor name, or code..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                />
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => {
                    const colors = TAB_COLORS[tab.key];
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${activeTab === tab.key
                                ? `${colors.active} shadow-sm`
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-transparent'
                                }`}
                        >
                            <Icon name={tab.icon} size={16} />
                            {tab.label}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? colors.badge : 'bg-slate-100 text-slate-400'
                                }`}>{tab.count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Error */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium"
                    >
                        <Icon name="AlertCircle" size={18} />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center">
                            <Icon name="X" size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invoice Cards */}
            <div className="space-y-3">
                {loading && allInvoices.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-sm text-slate-400 font-medium">Loading workflow data...</p>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                            <Icon name="Inbox" size={28} className="text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-400">No invoices found</p>
                        <p className="text-xs text-slate-300 mt-1">
                            {searchQuery ? 'Try a different search term.' : 'No invoices match this filter.'}
                        </p>
                    </div>
                ) : (
                    filteredInvoices.map((inv, idx) => {
                        const stage = getWorkflowStage(inv);
                        const stageInfo = getStageInfo(stage);
                        return (
                            <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden"
                            >
                                <div className="p-4 sm:p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        {/* Left */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center font-bold text-indigo-600 text-xs shrink-0">
                                                {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-slate-800 text-sm">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${stageInfo.color}`}>
                                                        <Icon name={stageInfo.icon} size={10} />
                                                        {stageInfo.label}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                                                    <span className="font-medium text-slate-500">{inv.vendorName || 'Unknown Vendor'}</span>
                                                    {inv.vendorCode && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="font-mono text-indigo-500 font-semibold">{inv.vendorCode}</span>
                                                        </>
                                                    )}
                                                    {inv.date && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{inv.date}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Amount */}
                                        <p className="text-lg sm:text-xl font-black text-slate-800 shrink-0 pl-13 sm:pl-0">
                                            ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                                        </p>
                                    </div>

                                    {/* Lifecycle Progress Tracker - Shows 7-stage workflow */}
                                    <LifecycleProgressTracker
                                        invoice={inv}
                                        options={{
                                            className: "rounded-xl border border-slate-200 dark:border-slate-800",
                                            showConnectorLines: true,
                                            highlightActive: true,
                                            showProgressBar: true,
                                            compact: false
                                        }}
                                    />

                                    {/* Legacy Approval Pipeline Tracker for reference */}
                                    <div className="mt-4 bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Vendor Step */}
                                            <div className="flex items-center gap-1.5">
                                                <div className={clsx(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center text-white",
                                                    "bg-emerald-500"
                                                )}>
                                                    <Icon name="CheckCircle2" size={14} />
                                                </div>
                                                <div className="hidden xs:block">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Vendor</p>
                                                    <p className="text-[10px] font-bold text-emerald-600">Submitted</p>
                                                </div>
                                            </div>

                                            <div className={clsx("flex-1 h-0.5 rounded-full mx-1", inv.financeApproval?.status ? 'bg-emerald-300' : 'bg-slate-200')} />

                                            {/* Finance Step */}
                                            <div className="flex items-center gap-1.5">
                                                <div className={clsx(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center",
                                                    inv.financeApproval?.status === 'APPROVED' ? "bg-emerald-500 text-white" :
                                                        inv.financeApproval?.status === 'REJECTED' ? "bg-rose-500 text-white" :
                                                            "bg-slate-200 text-slate-400"
                                                )}>
                                                    <Icon name={
                                                        inv.financeApproval?.status === 'APPROVED' ? 'CheckCircle2' :
                                                            inv.financeApproval?.status === 'REJECTED' ? 'XCircle' : 'Clock'
                                                    } size={14} />
                                                </div>
                                                <div className="hidden xs:block">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Finance</p>
                                                    <p className={clsx("text-[10px] font-bold",
                                                        inv.financeApproval?.status === 'APPROVED' ? 'text-emerald-600' :
                                                            inv.financeApproval?.status === 'REJECTED' ? 'text-rose-600' : 'text-slate-400'
                                                    )}>
                                                        {inv.financeApproval?.status === 'APPROVED' ? 'Approved' :
                                                            inv.financeApproval?.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={clsx("flex-1 h-0.5 rounded-full mx-1", inv.pmApproval?.status ? (inv.pmApproval?.status === 'APPROVED' ? 'bg-emerald-300' : 'bg-rose-300') : 'bg-slate-200')} />

                                            {/* PM Step */}
                                            <div className="flex items-center gap-1.5">
                                                <div className={clsx(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center",
                                                    inv.pmApproval?.status === 'APPROVED' ? "bg-emerald-500 text-white" :
                                                        inv.pmApproval?.status === 'REJECTED' ? "bg-rose-500 text-white" :
                                                            "bg-slate-200 text-slate-400"
                                                )}>
                                                    <Icon name={
                                                        inv.pmApproval?.status === 'APPROVED' ? 'CheckCircle2' :
                                                            inv.pmApproval?.status === 'REJECTED' ? 'XCircle' : 'Clock'
                                                    } size={14} />
                                                </div>
                                                <div className="hidden xs:block">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">PM</p>
                                                    <p className={clsx("text-[10px] font-bold",
                                                        inv.pmApproval?.status === 'APPROVED' ? 'text-emerald-600' :
                                                            inv.pmApproval?.status === 'REJECTED' ? 'text-rose-600' : 'text-slate-400'
                                                    )}>
                                                        {inv.pmApproval?.status === 'APPROVED' ? 'Approved' :
                                                            inv.pmApproval?.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes / Details Tags */}
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {inv.financeApproval?.notes && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg max-w-xs truncate" title={inv.financeApproval.notes}>
                                                <Icon name="MessageSquare" size={10} /> Finance: {inv.financeApproval.notes}
                                            </span>
                                        )}
                                        {inv.pmApproval?.notes && (
                                            <span className={clsx("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg max-w-xs truncate",
                                                inv.pmApproval.status === 'REJECTED' ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'
                                            )} title={inv.pmApproval.notes}>
                                                <Icon name="MessageSquare" size={10} /> PM: {inv.pmApproval.notes}
                                            </span>
                                        )}
                                        {inv.poNumber && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                <Icon name="Hash" size={10} /> PO: {inv.poNumber}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Action Bar */}
                                <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewDocument(inv.id)}
                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                        >
                                            <Icon name="Eye" size={14} />
                                            View Doc
                                        </button>
                                        <a
                                            href={`/api/invoices/${inv.id}/file`}
                                            download={inv.originalName || `invoice-${inv.id}`}
                                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all"
                                        >
                                            <Icon name="Download" size={14} />
                                            Download
                                        </a>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {inv.submittedAt ? new Date(inv.submittedAt).toLocaleDateString() : inv.date || ''}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Document Viewer Modal */}
            <AnimatePresence>
                {viewerInvoiceId && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setViewerInvoiceId(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="relative bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden z-101 flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/70 shrink-0">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm truncate mr-4">
                                        {allInvoices.find((i) => i.id === viewerInvoiceId)?.originalName || `Invoice ${viewerInvoiceId}`}
                                    </h3>
                                    <p className="text-[10px] text-slate-400">
                                        {allInvoices.find((i) => i.id === viewerInvoiceId)?.vendorName || ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={`/api/invoices/${viewerInvoiceId}/file`}
                                        download
                                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all inline-flex items-center gap-1.5"
                                    >
                                        <Icon name="Download" size={14} />
                                        Download
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setViewerInvoiceId(null)}
                                        className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                                    >
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[60vh] max-h-[80vh] bg-slate-100 relative overflow-auto">
                                {viewerLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                    </div>
                                )}
                                {(() => {
                                    const inv = allInvoices.find(i => i.id === viewerInvoiceId);
                                    if (!inv) return null;
                                    return (
                                        <DocumentViewer
                                            invoiceId={viewerInvoiceId}
                                            fileName={inv.originalName}
                                            spreadsheetData={spreadsheetData}
                                            onLoadingComplete={() => setViewerLoading(false)}
                                        />
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
