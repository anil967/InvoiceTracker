'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';
import DocumentViewer from '@/components/ui/DocumentViewer';
import LifecycleProgressTracker from '@/components/Lifecycle/LifecycleProgressTracker';

/* ——— helpers ————————————————————————————————————————————————— */
const fmt = (n) => n != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n)) : '—';
const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
};
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const PM_STATUS_MAP = {
    APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
    REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
    INFO_REQUESTED: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Info Requested' },
};

const STATUS_STYLES = {
    [INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW]: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', label: 'Pending Review' },
    'Pending Dept Head Review': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', label: 'Pending Review' },
    [INVOICE_STATUS.RECHECK_BY_DIV_HEAD]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Re-check Requested' },
    'Re-check by Div Head': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Re-check Requested' },
    [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW]: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Sent to Div Head' },
    'Pending Div Head Review': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Sent to Div Head' },
    [INVOICE_STATUS.DIV_HEAD_APPROVED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Final Approved' },
    'Div Head Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Final Approved' },
    [INVOICE_STATUS.DEPT_HEAD_REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    'Dept Head Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    [INVOICE_STATUS.MORE_INFO_NEEDED]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'More Info Needed' },
    [INVOICE_STATUS.PENDING_PM_APPROVAL]: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Pending PM' },
    [INVOICE_STATUS.PM_REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'PM Rejected' },
    Submitted: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Submitted' },
};
const getStatus = (s) => STATUS_STYLES[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: s?.replace(/_/g, ' ') || '—' };

const DOC_TYPE_OPTIONS = ['INVOICE', 'TIMESHEET', 'RFP_COMMERCIAL', 'RINGI', 'ANNEX', 'OTHER'];

function Section({ title, icon, children, accent = 'teal' }) {
    const colors = { teal: 'text-teal-600 bg-teal-50', emerald: 'text-emerald-600 bg-emerald-50', violet: 'text-violet-600 bg-violet-50', amber: 'text-amber-600 bg-amber-50', sky: 'text-sky-600 bg-sky-50' };
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

/* ——— Main Component ————————————————————————————————————————————— */
export default function DeptHeadApprovalQueuePage() {
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

    const [deptDocs, setDeptDocs] = useState([]);
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

    const fetchDeptDocs = async (invoiceId) => {
        try {
            const res = await fetch(`/api/dept-head/documents?invoiceId=${invoiceId}&uploadedByRole=Department+Head`, { cache: 'no-store' });
            const data = await res.json();
            setDeptDocs(res.ok ? (data.documents || []) : []);
        } catch { setDeptDocs([]); }
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
        setDeptDocs([]);
        setPmUploadedDocs([]);
        setVendorDocs([]);
        setDocViewer(null);
        setSpreadsheetData(null);
        try {
            const res = await fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) {
                setReviewInvoice(data.invoice || data);
                fetchDeptDocs(inv.id);
                fetchPmDocs(inv.id);
                fetchVendorDocs(inv.id);
            }
        } catch (err) {
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
        setDeptDocs([]);
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
            const res = await fetch(`/api/dept-head/approve/${invoiceId}`, {
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
            const res = await fetch('/api/dept-head/documents', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setUploadForm({ file: null, type: 'RINGI', description: '' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            await fetchDeptDocs(reviewInvoice.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    // Tab filtering â€” pending = invoices awaiting dept head action
    const DEPT_HEAD_PENDING_STATUSES = [
        INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
        'Pending Dept Head Review',
    ];
    const DEPT_HEAD_APPROVED_STATUSES = [
        INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
        INVOICE_STATUS.DIV_HEAD_APPROVED,
        'Pending Div Head Review',
        'Div Head Approved',
    ];

    const DEPT_HEAD_RECHECK_STATUSES = [
        INVOICE_STATUS.RECHECK_BY_DIV_HEAD,
        'Re-check by Div Head',
    ];

    const tabs = useMemo(() => ({
        pending: allInvoices.filter(inv => DEPT_HEAD_PENDING_STATUSES.includes(inv.status)),
        recheck: allInvoices.filter(inv => DEPT_HEAD_RECHECK_STATUSES.includes(inv.status)),
        reviewed: allInvoices.filter(inv => DEPT_HEAD_APPROVED_STATUSES.includes(inv.status)),
        rejected: allInvoices.filter(inv =>
            inv.status === INVOICE_STATUS.DEPT_HEAD_REJECTED ||
            inv.status === 'Dept Head Rejected' ||
            inv.deptHeadApproval?.status === 'REJECTED'
        ),
    }), [allInvoices]);

    const visibleInvoices = tabs[activeTab] || [];

    const TABS = [
        { key: 'pending', label: 'Pending', icon: 'Clock', color: 'teal' },
        { key: 'recheck', label: 'Re-check', icon: 'RotateCcw', color: 'amber' },
        { key: 'reviewed', label: 'Forwarded', icon: 'CheckCircle2', color: 'emerald' },
        { key: 'rejected', label: 'Rejected', icon: 'XCircle', color: 'rose' },
    ];

    const TAB_COLORS = {
        teal: { active: 'bg-teal-600 text-white shadow-sm', dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700' },
        amber: { active: 'bg-amber-500 text-white shadow-sm', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
        emerald: { active: 'bg-emerald-600 text-white shadow-sm', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
        rose: { active: 'bg-rose-600 text-white shadow-sm', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' },
    };

    return (
        <div className="space-y-5 pb-10">
            {/* â”€â”€â”€ Left Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Dept Head Approval Queue</h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Review and action invoices forwarded from Project Managers</p>
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
                            <Icon name="CheckCircle2" size={18} />
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
                        <div className="w-10 h-10 border-[3px] border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm font-medium text-slate-400">Loading invoices...</p>
                    </div>
                ) : visibleInvoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                            <Icon name="Inbox" size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-500">No invoices found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {activeTab === 'pending' ? 'No invoices pending your review' : `No ${activeTab} invoices`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {visibleInvoices.map((inv, i) => {
                            const sc = getStatus(inv.status);
                            const pmSc = PM_STATUS_MAP[inv.pmApproval?.status] || PM_STATUS_MAP.PENDING;
                            const isOpen = reviewInvoice?.id === inv.id && drawerOpen;
                            return (
                                <motion.div key={inv.id}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
                                    onClick={() => openDrawer(inv)}
                                    className={`group rounded-2xl border bg-white p-4 cursor-pointer transition-all hover:shadow-md ${isOpen ? 'border-teal-300 shadow-md ring-1 ring-teal-200' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100/60 flex items-center justify-center text-teal-600 font-black text-xs shrink-0">
                                            {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{inv.invoiceNumber || inv.id?.slice(0, 8)}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">
                                                        {inv.vendorCode && <span className="font-mono text-teal-500 font-semibold mr-1">{inv.vendorCode}</span>}
                                                        {inv.vendorName || 'Unknown Vendor'} Â· {fmtDate(inv.date)}
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
                                            <div className="flex items-center justify-between gap-3 mt-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg ${pmSc.bg} ${pmSc.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${pmSc.dot}`} />
                                                        PM: {pmSc.label}
                                                    </span>
                                                    {(inv.status === INVOICE_STATUS.RECHECK_BY_DIV_HEAD || inv.status === 'Re-check by Div Head') && (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                                            <Icon name="RotateCcw" size={9} /> Returned by Div Head
                                                        </span>
                                                    )}
                                                </div>
                                                <Icon name="ChevronRight" size={14} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* â”€â”€â”€ Review Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeDrawer}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />

                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-slate-50 shadow-2xl z-50 flex flex-col overflow-hidden">
                            {/* Drawer Header */}
                            <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-slate-800 text-base">Review Invoice</h2>
                                    {reviewInvoice && <p className="text-[11px] text-slate-400 mt-0.5">{reviewInvoice.invoiceNumber || reviewInvoice.id?.slice(0, 12)}</p>}
                                </div>
                                <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                    <Icon name="X" size={16} />
                                </button>
                            </div>

                            {reviewLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                                </div>
                            ) : reviewInvoice ? (
                                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                    {/* Invoice Details */}
                                    <Section title="Invoice Details" icon="FileText" accent="teal">
                                        <div className="grid grid-cols-2 gap-4">
                                            <KV label="Invoice #" value={reviewInvoice.invoiceNumber} mono />
                                            <KV label="Amount" value={fmt(reviewInvoice.amount)} />
                                            <KV label="Date" value={fmtDate(reviewInvoice.date)} />
                                            <KV label="Vendor" value={reviewInvoice.vendorName} />
                                            <KV label="Vendor Code" value={reviewInvoice.vendorCode} mono />
                                        </div>
                                    </Section>

                                    {/* Vendor Details */}
                                    <Section title="Vendor Details" icon="Building2" accent="teal">
                                        <div className="grid grid-cols-2 gap-4">
                                            <KV label="Vendor Name" value={reviewInvoice.vendorName} />
                                            <KV label="Vendor Code" value={reviewInvoice.vendorCode} mono />
                                            <KV label="Vendor ID" value={reviewInvoice.vendorId} mono />
                                            <KV label="Submitted On" value={fmtDate(reviewInvoice.receivedAt || reviewInvoice.date)} />
                                        </div>
                                    </Section>

                                    {/* Documents Uploaded by Vendor */}
                                    <Section title="Documents Uploaded by Vendor" icon="Paperclip" accent="sky">
                                        <div className="space-y-3">
                                            {/* Primary Invoice */}
                                            {(reviewInvoice.originalName || reviewInvoice.fileUrl) && (
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                                                            <Icon name="FileText" size={14} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{reviewInvoice.originalName || 'Invoice Document'}</p>
                                                            <p className="text-[9px] text-slate-400">Primary Invoice</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => setDocViewer({ invoiceId: reviewInvoice.id, fileName: reviewInvoice.originalName, title: 'Invoice' })}
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
                                            {/* Additional Vendor Docs (RFP, Timesheet) */}
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
                                                        <button
                                                            onClick={() => setDocViewer({ docId: doc.documentId, fileName: doc.fileName, title: doc.type, forceSpreadsheet: doc.type === 'TIMESHEET' })}
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

                                    {/* PM Approval Trail */}
                                    {reviewInvoice.pmApproval && (
                                        <Section title="PM Approval Record" icon="ClipboardCheck" accent="violet">
                                            <div className="grid grid-cols-2 gap-4">
                                                <KV label="Status" value={reviewInvoice.pmApproval.status} />
                                                <KV label="Approved By" value={reviewInvoice.pmApproval.approvedByName} />
                                                <KV label="Date" value={fmtDateTime(reviewInvoice.pmApproval.approvedAt)} />
                                                {reviewInvoice.pmApproval.notes && (
                                                    <div className="col-span-2">
                                                        <KV label="PM Notes" value={reviewInvoice.pmApproval.notes} />
                                                    </div>
                                                )}
                                            </div>
                                        </Section>
                                    )}

                                    {/* PM Documents */}
                                    {pmUploadedDocs.length > 0 && (
                                        <Section title="PM Uploaded Documents" icon="FolderOpen" accent="sky">
                                            <div className="space-y-2">
                                                {pmUploadedDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                                                                <Icon name="FileType" size={12} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</p>
                                                                <p className="text-[9px] text-slate-400 uppercase">{doc.type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type, forceSpreadsheet: doc.type === 'TIMESHEET' })}
                                                                className="h-6 px-2.5 rounded-lg bg-white border border-sky-200 text-sky-600 text-[10px] font-bold hover:bg-sky-50 transition-all inline-flex items-center gap-1">
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

                                    {/* Dept Head Documents */}
                                    <Section title="Department Head Documents" icon="Upload" accent="teal">
                                        {deptDocs.length > 0 && (
                                            <div className="space-y-2 mb-4">
                                                {deptDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                                                <Icon name="FileText" size={12} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</p>
                                                                <p className="text-[9px] text-slate-400 uppercase">{doc.type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type, invoiceId: reviewInvoice.id, forceSpreadsheet: doc.type === 'TIMESHEET' })}
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
                                        )}
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <select value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}
                                                    className="flex-1 text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400">
                                                    {DOC_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer font-medium transition-all">
                                                    <Icon name="Plus" size={12} />
                                                    <span>Choose file</span>
                                                    <input ref={fileInputRef} type="file" className="hidden"
                                                        onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
                                                </label>
                                            </div>
                                            {uploadForm.file && (
                                                <div className="flex items-center gap-2 p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                                                    <Icon name="FileText" size={12} className="text-teal-600 shrink-0" />
                                                    <p className="text-xs font-medium text-teal-700 truncate flex-1">{uploadForm.file.name}</p>
                                                    <button onClick={handleUpload} disabled={uploading}
                                                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-all">
                                                        {uploading ? 'Uploadingâ€¦' : 'Upload'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </Section>

                                    {/* Re-check History */}
                                    {(() => {
                                        const recheckHistory = (reviewInvoice.auditTrail || []).filter(entry =>
                                            entry.action === 'RECHECK' ||
                                            entry.action === 'REQUEST_INFO' ||
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
                                                                        {entry.action === 'REQUEST_INFO' ? 'Sent to Vendor' : 'Sent back for Re-check'}
                                                                    </p>
                                                                    <span className="text-[10px] text-violet-500">
                                                                        {fmtDateTime(entry.timestamp)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-violet-600 mt-0.5">
                                                                    By: <span className="font-semibold">{entry.actor || entry.actorRole || 'Unknown'}</span>
                                                                    {entry.actorRole && <span className="opacity-70"> ({entry.actorRole})</span>}
                                                                </p>
                                                                {entry.notes && (
                                                                    <p className="text-[10px] text-slate-500 mt-1 italic">"{entry.notes}"</p>
                                                                )}
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

                                    {/* Actions */}
                                    {(reviewInvoice.status === INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW ||
                                        reviewInvoice.status === 'Pending Dept Head Review' ||
                                        reviewInvoice.status === INVOICE_STATUS.RECHECK_BY_DIV_HEAD ||
                                        reviewInvoice.status === 'Re-check by Div Head') && (
                                            <div className="sticky bottom-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Take Action</h3>

                                                {/* Re-check returned banner */}
                                                {(reviewInvoice.status === INVOICE_STATUS.RECHECK_BY_DIV_HEAD ||
                                                    reviewInvoice.status === 'Re-check by Div Head') && (
                                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-2">
                                                        <Icon name="RotateCcw" size={14} className="shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold">Returned by Divisional Head for re-check</p>
                                                            <p className="text-[10px] opacity-70 mt-0.5">Review and re-approve to forward back to Div Head, or re-check to PM.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {actionType && (
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-500">
                                                            {actionType === 'REJECT' ? 'Reason for rejection *' : 'Notes (optional)'}
                                                        </label>
                                                        <textarea
                                                            value={actionNotes}
                                                            onChange={e => setActionNotes(e.target.value)}
                                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                                            placeholder={actionType === 'REJECT' ? 'Enter rejection reason...' : 'Add notes...'}
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    {actionType ? (
                                                        <>
                                                            <button onClick={() => { setActionType(null); setActionNotes(''); }}
                                                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-all">
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleAction(reviewInvoice.id, actionType)}
                                                                disabled={!!processingId}
                                                                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-all text-white ${actionType === 'REJECT'
                                                                    ? 'bg-rose-600 hover:bg-rose-700'
                                                                    : actionType === 'REQUEST_INFO'
                                                                        ? 'bg-amber-500 hover:bg-amber-600'
                                                                        : 'bg-teal-600 hover:bg-teal-700'} disabled:opacity-50`}>
                                                                {processingId ? 'Processing...' : 'Confirm'}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => setActionType('REJECT')}
                                                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-sm transition-all">
                                                                <Icon name="X" size={13} />
                                                                Reject
                                                            </button>
                                                            <button onClick={() => setActionType('REQUEST_INFO')}
                                                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-50 font-semibold text-sm transition-all">
                                                                <Icon name="MessageSquare" size={13} />
                                                                Request Info
                                                            </button>
                                                            <button onClick={() => setActionType('RECHECK')}
                                                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-violet-200 text-violet-600 hover:bg-violet-50 font-semibold text-sm transition-all">
                                                                <Icon name="RotateCcw" size={13} />
                                                                Re-check
                                                            </button>
                                                            <button onClick={() => handleAction(reviewInvoice.id, 'APPROVE')}
                                                                disabled={!!processingId}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-bold text-sm transition-all disabled:opacity-50">
                                                                <Icon name="CheckCircle2" size={14} />
                                                                {processingId ? 'Processing...' : 'Forward to Div Head'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}


                                </div>
                            ) : null}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* â”€â”€â”€ Document Viewer Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-teal-50 hover:text-teal-600 transition-all inline-flex items-center gap-1.5">
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
