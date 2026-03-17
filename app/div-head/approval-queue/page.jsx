'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';
import DocumentViewer from '@/components/ui/DocumentViewer';
import LifecycleProgressTracker from '@/components/Lifecycle/LifecycleProgressTracker';

const fmt = (n) => n != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n)) : '—';
const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
};
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const DEPT_HEAD_STATUS_MAP = {
    APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
    REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    INFO_REQUESTED: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Info Requested' },
};

const STATUS_STYLES = {
    [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW]: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Pending Review' },
    'Pending Div Head Review': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Pending Review' },
    [INVOICE_STATUS.RECHECK_BY_DIV_HEAD]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Re-check Sent' },
    'Re-check by Div Head': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Re-check Sent' },
    [INVOICE_STATUS.DIV_HEAD_APPROVED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Final Approved' },
    'Div Head Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Final Approved' },
    [INVOICE_STATUS.DIV_HEAD_REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    'Div Head Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    [INVOICE_STATUS.MORE_INFO_NEEDED]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'More Info Needed' },
};
const getStatus = (s) => STATUS_STYLES[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: s?.replace(/_/g, ' ') || '—' };

const DOC_TYPE_OPTIONS = ['INVOICE', 'TIMESHEET', 'RFP_COMMERCIAL', 'RINGI', 'ANNEX', 'OTHER'];

function Section({ title, icon, children, accent = 'indigo' }) {
    const colors = { indigo: 'text-indigo-600 bg-indigo-50', emerald: 'text-emerald-600 bg-emerald-50', violet: 'text-violet-600 bg-violet-50', teal: 'text-teal-600 bg-teal-50', sky: 'text-sky-600 bg-sky-50', amber: 'text-amber-600 bg-amber-50' };
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/60">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[accent]}`}>
                    <Icon name={icon} size={14} />
                </div>
                <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function KV({ label, value, mono = false }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
        </div>
    );
}

export default function DivHeadApprovalQueuePage() {
    const { user } = useAuth();
    const [allInvoices, setAllInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    const [reviewInvoice, setReviewInvoice] = useState(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [actionType, setActionType] = useState(null);
    const [actionNotes, setActionNotes] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const [docViewer, setDocViewer] = useState(null);
    const [spreadsheetData, setSpreadsheetData] = useState(null);

    const [divDocs, setDivDocs] = useState([]);
    const [deptUploadedDocs, setDeptUploadedDocs] = useState([]);
    const [pmUploadedDocs, setPmUploadedDocs] = useState([]);
    const [vendorDocs, setVendorDocs] = useState([]);
    const [uploadForm, setUploadForm] = useState({ file: null, type: 'RINGI', description: '' });
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!docViewer) { setSpreadsheetData(null); return; }
        const ext = (docViewer.fileName || '').toLowerCase();
        const isSheet = ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.csv');
        if (!isSheet) { setSpreadsheetData(null); return; }
        if (!docViewer.docId && !docViewer.invoiceId) { setSpreadsheetData(null); return; }
        let cancelled = false;
        (async () => {
            try {
                const url = docViewer.docId
                    ? `/api/documents/${docViewer.docId}/preview`
                    : `/api/invoices/${docViewer.invoiceId}/preview`;
                const r = await fetch(url, { cache: 'no-store' });
                const d = await r.json();
                if (!cancelled && Array.isArray(d?.data)) setSpreadsheetData(d.data);
            } catch { }
        })();
        return () => { cancelled = true; };
    }, [docViewer]);

    useEffect(() => { fetchInvoices(); }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') closeDrawer(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/invoices?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setAllInvoices(Array.isArray(data) ? data : (data.invoices || []));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDivDocs = async (invoiceId) => {
        try {
            const res = await fetch(`/api/div-head/documents?invoiceId=${invoiceId}&uploadedByRole=Divisional+Head`, { cache: 'no-store' });
            const data = await res.json();
            setDivDocs(res.ok ? (data.documents || []) : []);
        } catch { setDivDocs([]); }
    };

    const fetchDeptDocs = async (invoiceId) => {
        try {
            const res = await fetch(`/api/dept-head/documents?invoiceId=${invoiceId}&uploadedByRole=Department+Head`, { cache: 'no-store' });
            const data = await res.json();
            setDeptUploadedDocs(res.ok ? (data.documents || []) : []);
        } catch { setDeptUploadedDocs([]); }
    };

    const fetchPmDocs = async (invoiceId) => {
        try {
            const res = await fetch(`/api/pm/documents?invoiceId=${invoiceId}&uploadedByRole=PM`, { cache: 'no-store' });
            const data = await res.json();
            setPmUploadedDocs(res.ok ? (data.documents || []) : []);
        } catch { setPmUploadedDocs([]); }
    };

    const fetchVendorDocs = async (invoiceId) => {
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/documents`, { cache: 'no-store' });
            const data = await res.json();
            // Only show docs actually uploaded by Vendor role (not PM/dept-head docs of the same types)
            setVendorDocs(res.ok ? (data.documents || []).filter(d => d.uploadedByRole === 'Vendor') : []);
        } catch { setVendorDocs([]); }
    };

    const openDrawer = async (inv) => {
        setDrawerOpen(true);
        setReviewInvoice(null);
        setReviewLoading(true);
        setActionType(null);
        setActionNotes('');
        setDivDocs([]);
        setDeptUploadedDocs([]);
        setPmUploadedDocs([]);
        setVendorDocs([]);
        setDocViewer(null);
        setSpreadsheetData(null);
        try {
            const res = await fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) {
                setReviewInvoice(data.invoice || data);
                fetchDivDocs(inv.id);
                fetchDeptDocs(inv.id);
                fetchPmDocs(inv.id);
                fetchVendorDocs(inv.id);
            }
        } catch {
            setError('Failed to load invoice details');
        } finally {
            setReviewLoading(false);
        }
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setReviewInvoice(null);
        setActionType(null);
        setActionNotes('');
        setDivDocs([]);
        setDeptUploadedDocs([]);
        setPmUploadedDocs([]);
        setVendorDocs([]);
        setDocViewer(null);
        setSpreadsheetData(null);
    };

    const handleAction = async (invoiceId, action) => {
        if (action === 'REJECT' && !actionNotes?.trim()) {
            setError('Please provide a reason for rejection.');
            return;
        }
        try {
            setProcessingId(invoiceId);
            const res = await fetch(`/api/div-head/approve/${invoiceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, notes: actionNotes || undefined })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');
            setSuccessMsg(data.message || `Invoice ${action.toLowerCase()}d successfully`);
            closeDrawer();
            await fetchInvoices();
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpload = async () => {
        if (!uploadForm.file || !reviewInvoice) return;
        try {
            setUploading(true);
            const fd = new FormData();
            fd.append('file', uploadForm.file);
            fd.append('type', uploadForm.type);
            fd.append('invoiceId', reviewInvoice.id);
            fd.append('description', uploadForm.description);
            const res = await fetch('/api/div-head/documents', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setUploadForm({ file: null, type: 'RINGI', description: '' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            await fetchDivDocs(reviewInvoice.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const DIV_HEAD_PENDING_STATUSES = [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW, 'Pending Div Head Review'];
    const DIV_HEAD_APPROVED_STATUSES = [INVOICE_STATUS.DIV_HEAD_APPROVED, 'Div Head Approved'];
    const DIV_HEAD_RECHECK_STATUSES = [INVOICE_STATUS.RECHECK_BY_DIV_HEAD, 'Re-check by Div Head'];

    const tabs = useMemo(() => ({
        pending: allInvoices.filter(inv => DIV_HEAD_PENDING_STATUSES.includes(inv.status)),
        recheck: allInvoices.filter(inv => DIV_HEAD_RECHECK_STATUSES.includes(inv.status)),
        approved: allInvoices.filter(inv => DIV_HEAD_APPROVED_STATUSES.includes(inv.status)),
        rejected: allInvoices.filter(inv =>
            inv.status === INVOICE_STATUS.DIV_HEAD_REJECTED ||
            inv.status === 'Div Head Rejected' ||
            inv.divHeadApproval?.status === 'REJECTED'
        ),
    }), [allInvoices]);

    const visibleInvoices = tabs[activeTab] || [];

    const TABS = [
        { key: 'pending', label: 'Pending', icon: 'Clock', color: 'indigo' },
        { key: 'recheck', label: 'Re-check', icon: 'RotateCcw', color: 'amber' },
        { key: 'approved', label: 'Finally Approved', icon: 'BadgeCheck', color: 'emerald' },
        { key: 'rejected', label: 'Rejected', icon: 'XCircle', color: 'rose' },
    ];

    const TAB_COLORS = {
        indigo: { active: 'bg-indigo-600 text-white shadow-sm', badge: 'bg-indigo-100 text-indigo-700' },
        amber: { active: 'bg-amber-500 text-white shadow-sm', badge: 'bg-amber-100 text-amber-700' },
        emerald: { active: 'bg-emerald-600 text-white shadow-sm', badge: 'bg-emerald-100 text-emerald-700' },
        rose: { active: 'bg-rose-600 text-white shadow-sm', badge: 'bg-rose-100 text-rose-700' },
    };

    return (
        <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-64px)] gap-0">
            {/* ─── Left Panel ─────────────────────────────────────── */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${drawerOpen ? 'lg:max-w-[55%]' : ''}`}>
                <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Div Head Final Approval Queue</h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Review and finally approve invoices forwarded by Department Head</p>
                        </div>
                        <button onClick={fetchInvoices} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all text-sm font-medium">
                            <Icon name="RefreshCw" size={15} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium">
                                <Icon name="AlertCircle" size={18} />
                                <span className="flex-1">{error}</span>
                                <button onClick={() => setError(null)} className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center">
                                    <Icon name="X" size={14} />
                                </button>
                            </motion.div>
                        )}
                        {successMsg && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
                                <Icon name="BadgeCheck" size={18} />
                                <span className="flex-1">{successMsg}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-fit">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const tc = TAB_COLORS[tab.color];
                            const count = tabs[tab.key]?.length || 0;
                            return (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${isActive ? tc.active : 'text-slate-500 hover:text-slate-700'}`}>
                                    <Icon name={tab.icon} size={14} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className={`min-w-[20px] h-5 px-1.5 rounded-md text-[10px] font-black flex items-center justify-center ${isActive ? 'bg-white/20 text-white' : `${tc.badge}`}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Invoice List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                            <p className="text-sm font-medium text-slate-400">Loading invoices...</p>
                        </div>
                    ) : visibleInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                <Icon name="Inbox" size={28} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-500">No invoices found</p>
                            <p className="text-xs text-slate-400 mt-1">
                                {activeTab === 'pending' ? 'No invoices pending your final approval' : `No ${activeTab} invoices`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {visibleInvoices.map((inv, i) => {
                                const sc = getStatus(inv.status);
                                const dhStatus = inv.deptHeadApproval?.status || (DIV_HEAD_PENDING_STATUSES.includes(inv.status) || DIV_HEAD_APPROVED_STATUSES.includes(inv.status) ? 'APPROVED' : null);
                                const dhSc = DEPT_HEAD_STATUS_MAP[dhStatus] || { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Pending' };
                                const isOpen = reviewInvoice?.id === inv.id && drawerOpen;
                                return (
                                    <motion.div key={inv.id}
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
                                        onClick={() => openDrawer(inv)}
                                        className={`group rounded-2xl border bg-white p-4 cursor-pointer transition-all hover:shadow-md ${isOpen ? 'border-indigo-300 shadow-md ring-1 ring-indigo-200' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                                                {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">
                                                            {inv.vendorCode && <span className="font-mono text-indigo-500 font-semibold mr-1">{inv.vendorCode}</span>}
                                                            {inv.vendorName || 'Unknown Vendor'} · {fmtDate(inv.date)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-slate-800">{fmt(inv.amount)}</p>
                                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg mt-0.5 ${sc.bg} ${sc.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                            {sc.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 mt-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg ${dhSc.bg} ${dhSc.text}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${dhSc.dot}`} />
                                                                Dept Head: {dhSc.label}
                                                            </span>
                                                        </div>
                                                        <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                                    </div>
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
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                REVIEW DRAWER
            ══════════════════════════════════════════════ */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeDrawer}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />

                        {/* Drawer panel */}
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-slate-50 shadow-2xl z-50 flex flex-col overflow-hidden">

                            {/* Header */}
                            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Div Head Review</p>
                                    <h2 className="font-black text-slate-800 text-lg leading-tight">
                                        {reviewInvoice?.invoiceNumber || reviewInvoice?.id?.slice(0, 12) || '…'}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {reviewInvoice && (
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg ${getStatus(reviewInvoice?.status).bg} ${getStatus(reviewInvoice?.status).text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatus(reviewInvoice?.status).dot ?? 'bg-current'}`} />
                                            {getStatus(reviewInvoice?.status).label}
                                        </span>
                                    )}
                                    <button onClick={closeDrawer}
                                        className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {reviewLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <p className="text-sm text-slate-400 font-medium">Loading invoice details…</p>
                                    </div>
                                ) : reviewInvoice ? (
                                    <>
                                        {/* Workflow Progress Tracker */}
                                        <LifecycleProgressTracker
                                            invoice={reviewInvoice}
                                            options={{
                                                className: "rounded-xl border border-slate-200 dark:border-slate-800",
                                                showConnectorLines: true,
                                                highlightActive: true,
                                                showProgressBar: true,
                                                compact: false
                                            }}
                                        />

                                        {/* Vendor Details */}
                                        <Section title="Vendor Details" icon="Building2" accent="indigo">
                                            <div className="grid grid-cols-2 gap-4">
                                                <KV label="Vendor Name" value={reviewInvoice.vendorName} />
                                                <KV label="Vendor Code" value={reviewInvoice.vendorCode} mono />
                                                <KV label="Invoice No." value={reviewInvoice.invoiceNumber} mono />
                                                <KV label="Invoice Date" value={reviewInvoice.invoiceDate || reviewInvoice.date} />
                                                <KV label="Billing Month" value={reviewInvoice.billingMonth || (reviewInvoice.invoiceDate || reviewInvoice.date)?.substring(0, 7)} />
                                            </div>
                                        </Section>

                                        {/* Invoice Financials */}
                                        <Section title="Invoice Financials" icon="IndianRupee" accent="emerald">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                                                    <p className="text-2xl font-black text-slate-800">{fmt(reviewInvoice.amount)}</p>
                                                </div>
                                                <KV label="Basic Amount (Pre-Tax)" value={fmt(reviewInvoice.basicAmount)} />
                                                <KV label="Tax Type" value={reviewInvoice.taxType?.replace('_', ' + ')} />
                                                <KV label="HSN Code" value={reviewInvoice.hsnCode} mono />
                                                <KV label="Currency" value={reviewInvoice.currency || 'INR'} />
                                                <KV label="PO Number" value={reviewInvoice.poNumber} mono />
                                            </div>
                                        </Section>

                                        {/* Documents Uploaded by Vendor */}
                                        <Section title="Documents Uploaded by Vendor" icon="Paperclip" accent="amber">
                                            <div className="space-y-2">
                                                {(reviewInvoice.originalName || reviewInvoice.fileUrl) && (
                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                                                <Icon name="FileText" size={14} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{reviewInvoice.originalName || 'Invoice Document'}</p>
                                                                <p className="text-[10px] text-slate-400">Primary Invoice</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button onClick={() => setDocViewer({ invoiceId: reviewInvoice.id, fileName: reviewInvoice.originalName, title: 'Invoice' })}
                                                                className="h-7 px-3 rounded-lg bg-white border border-sky-200 text-sky-600 text-[10px] font-bold hover:bg-sky-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Eye" size={11} /> View
                                                            </button>
                                                            <a href={`/api/invoices/${reviewInvoice.id}/file`} download={reviewInvoice.originalName || 'invoice'}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Download" size={11} /> Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {vendorDocs.filter(d => d.type !== 'INVOICE').map((doc, i) => (
                                                    <div key={doc.documentId || i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                                <Icon name="File" size={14} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{doc.fileName || `Document ${i + 1}`}</p>
                                                                <p className="text-[9px] text-slate-400 uppercase">{doc.type === 'ANNEX' || doc.type === 'RFP_COMMERCIAL' ? 'RFP Document' : doc.type === 'TIMESHEET' ? 'Timesheet' : doc.type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button onClick={() => setDocViewer({ docId: doc.documentId, fileName: doc.fileName, title: doc.type, forceSpreadsheet: doc.type === 'TIMESHEET' })}
                                                                className="h-7 px-3 rounded-lg bg-white border border-violet-200 text-violet-600 text-[10px] font-bold hover:bg-violet-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Eye" size={11} /> View
                                                            </button>
                                                            <a href={`/api/documents/${doc.documentId}/file`} download={doc.fileName || doc.documentId}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Download" size={11} /> Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                                {!reviewInvoice.originalName && !reviewInvoice.fileUrl && vendorDocs.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic">No vendor documents attached.</p>
                                                )}
                                            </div>
                                        </Section>

                                        {/* PM Approval */}
                                        {reviewInvoice.pmApproval && (
                                            <Section title="PM Approval" icon="ClipboardCheck" accent="violet">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <KV label="Status" value={reviewInvoice.pmApproval.status} />
                                                    <KV label="By" value={reviewInvoice.pmApproval.approvedByName} />
                                                    <KV label="Date" value={fmtDateTime(reviewInvoice.pmApproval.approvedAt)} />
                                                    {reviewInvoice.pmApproval.notes && <div className="col-span-2"><KV label="Notes" value={reviewInvoice.pmApproval.notes} /></div>}
                                                </div>
                                            </Section>
                                        )}

                                        {/* PM Uploaded Documents */}
                                        {pmUploadedDocs.length > 0 && (
                                            <Section title="PM Documents" icon="FolderOpen" accent="violet">
                                                <div className="space-y-2">
                                                    {pmUploadedDocs.map(doc => (
                                                        <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                                                                    <Icon name="FileType" size={12} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</p>
                                                                    <p className="text-[9px] text-slate-400 uppercase">{doc.type}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <button onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type, forceSpreadsheet: doc.type === 'TIMESHEET' })}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-violet-200 text-violet-600 text-[10px] font-bold hover:bg-violet-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Eye" size={10} /> View
                                                                </button>
                                                                <a href={`/api/documents/${doc.id}/file`} download={doc.fileName || doc.id}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Download" size={10} /> Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Section>
                                        )}

                                        {/* Dept Head Approval */}
                                        {reviewInvoice.deptHeadApproval?.status && (
                                            <Section title="Department Head Approval" icon="BadgeCheck" accent="teal">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <KV label="Status" value={reviewInvoice.deptHeadApproval.status} />
                                                    <KV label="By" value={reviewInvoice.deptHeadApproval.approvedByName} />
                                                    <KV label="Date" value={fmtDateTime(reviewInvoice.deptHeadApproval.approvedAt)} />
                                                    {reviewInvoice.deptHeadApproval.notes && <div className="col-span-2"><KV label="Notes" value={reviewInvoice.deptHeadApproval.notes} /></div>}
                                                </div>
                                            </Section>
                                        )}

                                        {/* Dept Head Documents */}
                                        {deptUploadedDocs.length > 0 && (
                                            <Section title="Dept Head Documents" icon="FolderOpen" accent="teal">
                                                <div className="space-y-2">
                                                    {deptUploadedDocs.map(doc => (
                                                        <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                                                    <Icon name="FileType" size={12} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</p>
                                                                    <p className="text-[9px] text-slate-400 uppercase">{doc.type}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <button onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type, invoiceId: reviewInvoice.id, forceSpreadsheet: doc.type === 'TIMESHEET' })}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-teal-200 text-teal-600 text-[10px] font-bold hover:bg-teal-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Eye" size={10} /> View
                                                                </button>
                                                                <a href={`/api/documents/${doc.id}/file`} download={doc.fileName || doc.id}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Download" size={10} /> Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Section>
                                        )}

                                        {/* Div Head Documents Upload */}
                                        <Section title="Divisional Head Documents" icon="Upload" accent="indigo">
                                            {divDocs.length > 0 && (
                                                <div className="space-y-2 mb-4">
                                                    {divDocs.map(doc => (
                                                        <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                                    <Icon name="FileText" size={12} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</p>
                                                                    <p className="text-[9px] text-slate-400 uppercase">{doc.type}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <button onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type, invoiceId: reviewInvoice.id, forceSpreadsheet: doc.type === 'TIMESHEET' })}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-indigo-200 text-indigo-600 text-[10px] font-bold hover:bg-indigo-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Eye" size={10} /> View
                                                                </button>
                                                                <a href={`/api/documents/${doc.id}/file`} download={doc.fileName || doc.id}
                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                    <Icon name="Download" size={10} /> Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <select value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}
                                                    className="flex-1 text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                    {DOC_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer font-medium transition-all">
                                                    <Icon name="Plus" size={12} />
                                                    <span>Choose file</span>
                                                    <input ref={fileInputRef} type="file" className="hidden"
                                                        onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
                                                </label>
                                            </div>
                                            {uploadForm.file && (
                                                <div className="flex items-center gap-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                                                    <Icon name="FileText" size={12} className="text-indigo-600 shrink-0" />
                                                    <p className="text-xs font-medium text-indigo-700 truncate flex-1">{uploadForm.file.name}</p>
                                                    <button onClick={handleUpload} disabled={uploading}
                                                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all">
                                                        {uploading ? 'Uploading…' : 'Upload'}
                                                    </button>
                                                </div>
                                            )}
                                        </Section>

                                        {/* Re-check History */}
                                        {(() => {
                                            const recheckHistory = (reviewInvoice.auditTrail || []).filter(entry =>
                                                entry.action === 'recheck' ||
                                                entry.action === 'RECHECK' ||
                                                entry.action === 'requested_info' ||
                                                entry.action === 'REQUEST_INFO' ||
                                                entry.newStatus === INVOICE_STATUS.RECHECK_BY_DIV_HEAD ||
                                                entry.newStatus === INVOICE_STATUS.RECHECK_BY_DEPT_HEAD ||
                                                entry.newStatus === 'More Info Needed'
                                            );
                                            if (recheckHistory.length === 0) return null;
                                            return (
                                                <Section title="Re-check History" icon="History" accent="violet">
                                                    <div className="space-y-2">
                                                        {recheckHistory.slice().reverse().map((entry, idx) => (
                                                            <div key={idx} className="flex items-start gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                                                                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                                    <Icon name="RotateCcw" size={14} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="text-xs font-bold text-violet-700">
                                                                            {entry.action === 'REQUEST_INFO' || entry.action === 'requested_info' ? 'Sent to Vendor' : 'Sent back for Re-check'}
                                                                        </p>
                                                                        <span className="text-[10px] text-violet-500">{fmtDateTime(entry.timestamp)}</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-violet-600 mt-0.5">
                                                                        By: <span className="font-semibold">{entry.actor || entry.actorRole || 'Unknown'}</span>
                                                                        {entry.actorRole && <span className="opacity-70"> ({entry.actorRole})</span>}
                                                                    </p>
                                                                    {entry.notes && <p className="text-[10px] text-slate-500 mt-1 italic">"{entry.notes}"</p>}
                                                                    {entry.previousStatus && entry.newStatus && (
                                                                        <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                                                                            <span className="font-mono">{entry.previousStatus}</span>
                                                                            <Icon name="ArrowRight" size={8} />
                                                                            <span className="font-mono">{entry.newStatus}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Section>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400 text-center py-20">No invoice selected.</p>
                                )}
                            </div>

                            {/* Footer Actions — sticky at bottom, outside scroll area */}
                            {reviewInvoice && (reviewInvoice.status === INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW || reviewInvoice.status === 'Pending Div Head Review') && (
                                <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
                                    {actionType === null ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => setActionType('REJECT')}
                                                className="flex-1 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center justify-center gap-1.5">
                                                <Icon name="XCircle" size={14} /> Reject
                                            </button>
                                            <button onClick={() => setActionType('REQUEST_INFO')}
                                                className="flex-1 h-10 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 text-xs font-bold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all flex items-center justify-center gap-1.5">
                                                <Icon name="MessageSquare" size={14} /> Request Info
                                            </button>
                                            <button onClick={() => setActionType('RECHECK')}
                                                className="flex-1 h-10 rounded-xl bg-violet-50 border border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-all flex items-center justify-center gap-1.5">
                                                <Icon name="RotateCcw" size={14} /> Re-check
                                            </button>
                                            <button onClick={() => handleAction(reviewInvoice.id, 'APPROVE')} disabled={!!processingId}
                                                className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-200 disabled:opacity-50">
                                                <Icon name="BadgeCheck" size={14} /> {processingId ? 'Processing…' : 'Final Approve'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className={`flex items-center gap-2 p-3 rounded-xl border ${
                                                actionType === 'APPROVE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                                                actionType === 'REJECT' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                actionType === 'RECHECK' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                                'bg-amber-50 border-amber-200 text-amber-700'
                                            }`}>
                                                <Icon name={actionType === 'APPROVE' ? 'BadgeCheck' : actionType === 'REJECT' ? 'XCircle' : actionType === 'RECHECK' ? 'RotateCcw' : 'MessageSquare'} size={15} />
                                                <p className="text-sm font-bold">
                                                    {actionType === 'APPROVE' ? 'Final approval — invoice finalized' :
                                                     actionType === 'REJECT' ? 'Rejecting this invoice — Dept Head will be notified' :
                                                     actionType === 'RECHECK' ? 'Sending back to Department Head for re-check' :
                                                     'Requesting additional information from vendor'}
                                                </p>
                                            </div>
                                            <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)} rows={2}
                                                placeholder={actionType === 'APPROVE' ? 'Add approval notes (optional)…' : actionType === 'RECHECK' ? 'Describe what needs re-checking…' : 'Reason for rejection (required)…'}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
                                            <div className="flex gap-2">
                                                <button onClick={() => { setActionType(null); setActionNotes(''); }}
                                                    className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleAction(reviewInvoice.id, actionType)}
                                                    disabled={!!processingId || (actionType === 'REJECT' && !actionNotes.trim())}
                                                    className={`flex-1 h-10 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
                                                        actionType === 'APPROVE' ? 'bg-indigo-600 hover:bg-indigo-700' :
                                                        actionType === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' :
                                                        actionType === 'RECHECK' ? 'bg-violet-600 hover:bg-violet-700' :
                                                        'bg-amber-500 hover:bg-amber-600'
                                                    }`}>
                                                    {processingId ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                                    {processingId ? 'Processing…' : actionType === 'APPROVE' ? 'Final Approve' : actionType === 'REJECT' ? 'Confirm Rejection' : actionType === 'RECHECK' ? 'Send for Re-check' : 'Request Info'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Already approved badge */}
                            {reviewInvoice && reviewInvoice.status === INVOICE_STATUS.DIV_HEAD_APPROVED && (
                                <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                                        <Icon name="BadgeCheck" size={16} />
                                        <div>
                                            <span className="text-sm font-bold">You gave final approval to this invoice</span>
                                            {reviewInvoice.divHeadApproval?.approvedAt && (
                                                <p className="text-[10px] opacity-70 mt-0.5">{fmtDateTime(reviewInvoice.divHeadApproval.approvedAt)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rejected badge */}
                            {reviewInvoice && reviewInvoice.status === INVOICE_STATUS.DIV_HEAD_REJECTED && (
                                <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                                        <Icon name="XCircle" size={16} />
                                        <span className="text-sm font-bold">You rejected this invoice</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {/* ─── Document Viewer Modal ─────────────────────────────────── */}
            <AnimatePresence>
                {docViewer && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                        onClick={() => setDocViewer(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">{docViewer.title || 'Document'}</h3>
                                    <p className="text-[10px] text-slate-400">{reviewInvoice?.vendorName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={docViewer.docId ? `/api/documents/${docViewer.docId}/file` : `/api/invoices/${docViewer.invoiceId}/file`}
                                        download={docViewer.fileName || 'document'}
                                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all inline-flex items-center gap-1.5">
                                        <Icon name="Download" size={14} /> Download
                                    </a>
                                    <button onClick={() => setDocViewer(null)}
                                        className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 relative min-h-0 overflow-y-auto" style={{ minHeight: '60vh' }}>
                                <DocumentViewer
                                    invoiceId={docViewer.invoiceId}
                                    fileName={docViewer.fileName}
                                    spreadsheetData={spreadsheetData}
                                    customFileUrl={docViewer.docId ? `/api/documents/${docViewer.docId}/file` : null}
                                    forceSpreadsheet={docViewer.forceSpreadsheet}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
