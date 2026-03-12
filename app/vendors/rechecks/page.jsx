"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";
import PageHeader from "@/components/Layout/PageHeader";

export default function VendorRechecks() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading re-check requests...</div>}>
            <VendorRechecksContent />
        </Suspense>
    );
}

function VendorRechecksContent() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [rechecks, setRechecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const fetchRechecks = useCallback(async () => {
        try {
            const res = await fetch('/api/vendor/rechecks', { cache: 'no-store' });
            if (!res.ok) {
                if (res.status === 401) { router.push('/login'); return; }
                throw new Error('Failed to fetch re-check requests');
            }
            const data = await res.json();
            setRechecks(data.rechecks || []);
        } catch (e) {
            console.error("Failed to fetch rechecks:", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        if (!authLoading && !user) { router.push("/login"); return; }
        if (user) fetchRechecks();
    }, [user, authLoading, router, fetchRechecks]);

    const handleMarkAsRead = async (messageId) => {
        try {
            const res = await fetch('/api/vendor/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageIds: [messageId] })
            });
            if (res.ok) {
                setRechecks(prev => prev.map(r =>
                    r.id === messageId ? { ...r, isRead: true, readAt: new Date().toISOString() } : r
                ));
            }
        } catch (e) {
            console.error("Failed to mark as read:", e);
        }
    };

    const handleViewInvoice = (invoiceId) => {
        router.push(`/vendors?invoiceId=${invoiceId}`);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="mt-4 text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    const unreadCount = rechecks.filter(r => !r.isRead).length;

    return (
        <div className="space-y-8 max-w-5xl mx-auto h-full pb-10 px-4 sm:px-6 lg:px-0">
            <PageHeader
                title="Re-check Requests"
                subtitle="Invoices that your Project Manager has sent back for re-verification."
                icon="AlertCircle"
                accent="amber"
                roleLabel="Vendor"
                actions={
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl border border-amber-200 text-xs font-black uppercase tracking-widest">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                {unreadCount} Unread
                            </div>
                        )}
                        <button
                            onClick={() => { setLoading(true); fetchRechecks(); }}
                            className="w-11 h-11 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center"
                            title="Refresh"
                        >
                            <Icon name="RefreshCw" size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                }
            />

            {/* Error Banner */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl text-sm font-medium flex items-center gap-3">
                    <Icon name="AlertTriangle" size={18} />
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-3xl border border-slate-100 p-8 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/3 bg-slate-100 rounded-lg" />
                                    <div className="h-3 w-1/2 bg-slate-50 rounded-lg" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : rechecks.length === 0 ? (
                /* Empty State */
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-16 text-center">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Icon name="CheckCircle2" size={48} className="text-emerald-300" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">All Clear!</h3>
                    <p className="text-slate-400 mt-3 font-medium max-w-md mx-auto">
                        No re-check requests at the moment. Your submitted invoices are progressing through the approval pipeline.
                    </p>
                </div>
            ) : (
                /* Re-check Cards */
                <div className="space-y-4">
                    <AnimatePresence>
                        {rechecks.map((recheck, idx) => {
                            const isExpanded = expandedId === recheck.id;
                            const inv = recheck.invoice;

                            return (
                                <motion.div
                                    key={recheck.id || idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={clsx(
                                        "bg-white rounded-3xl border shadow-sm transition-all hover:shadow-lg",
                                        !recheck.isRead
                                            ? "border-amber-200 shadow-amber-100/50 ring-2 ring-amber-100"
                                            : "border-slate-100"
                                    )}
                                >
                                    {/* Card Header */}
                                    <div
                                        className="p-6 sm:p-8 cursor-pointer"
                                        onClick={() => setExpandedId(isExpanded ? null : recheck.id)}
                                    >
                                        <div className="flex items-start gap-5">
                                            {/* Icon */}
                                            <div className={clsx(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all",
                                                !recheck.isRead
                                                    ? "bg-amber-500 text-white shadow-amber-500/20"
                                                    : "bg-slate-100 text-slate-400"
                                            )}>
                                                <Icon name={!recheck.isRead ? "AlertCircle" : "CheckCircle2"} size={26} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">
                                                        {recheck.subject || 'Re-check Request'}
                                                    </h3>
                                                    {!recheck.isRead && (
                                                        <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                                                            New
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Invoice Reference */}
                                                {inv && (
                                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                        <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">
                                                            {inv.invoiceNumber || inv.id?.slice(0, 8)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                            {inv.vendorName}
                                                        </span>
                                                        {inv.amount && (
                                                            <span className="text-xs font-black text-slate-600">
                                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inv.amount)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* PM Info + Date */}
                                                <div className="flex items-center gap-4 mt-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                                                            <Icon name="User" size={12} />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-500">
                                                            From: {recheck.senderName}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                                        {formatDate(recheck.created_at)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expand Arrow */}
                                            <div className="shrink-0 pt-1">
                                                <motion.div
                                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <Icon name="ChevronDown" size={20} className="text-slate-300" />
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 sm:px-8 pb-6 sm:pb-8 border-t border-slate-100">
                                                    {/* PM's Message */}
                                                    <div className="mt-6 bg-amber-50/80 border border-amber-200 rounded-2xl p-5 sm:p-6">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Icon name="MessageSquare" size={16} className="text-amber-600" />
                                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">
                                                                PM&apos;s Message
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                                            {recheck.content || 'Please re-check the submitted documents and re-submit.'}
                                                        </p>
                                                    </div>

                                                    {/* Invoice Details Card */}
                                                    {inv && (
                                                        <div className="mt-4 bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-100">
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <Icon name="FileText" size={16} className="text-slate-400" />
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                                                    Invoice Details
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice #</p>
                                                                    <p className="text-sm font-black text-slate-800">{inv.invoiceNumber || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                                                                    <p className="text-sm font-black text-slate-800">
                                                                        {inv.amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inv.amount) : '—'}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[10px] font-black uppercase tracking-wider">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                        {inv.status}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Document</p>
                                                                    <p className="text-sm font-bold text-slate-600 truncate" title={inv.originalName}>{inv.originalName || '—'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <div className="mt-6 flex items-center gap-3 flex-wrap">
                                                        {inv && (
                                                            <button
                                                                onClick={() => handleViewInvoice(inv.id)}
                                                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 active:scale-95 transition-all"
                                                            >
                                                                <Icon name="Eye" size={16} />
                                                                View Invoice
                                                            </button>
                                                        )}
                                                        {!recheck.isRead && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(recheck.id)}
                                                                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all"
                                                            >
                                                                <Icon name="Check" size={16} />
                                                                Mark as Read
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => router.push('/pm/messages')}
                                                            className="flex items-center gap-2 px-6 py-3 bg-white text-teal-600 border border-teal-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-50 active:scale-95 transition-all"
                                                        >
                                                            <Icon name="MessageCircle" size={16} />
                                                            Reply to PM
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
