'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';
import DocumentViewer from '@/components/ui/DocumentViewer';

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
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
    [INVOICE_STATUS.PENDING_FINANCE_REVIEW]: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Pending Review' },
    [INVOICE_STATUS.FINANCE_APPROVED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
    [INVOICE_STATUS.FINANCE_REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
    [INVOICE_STATUS.MORE_INFO_NEEDED]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'More Info Needed' },
    [INVOICE_STATUS.PENDING_PM_APPROVAL]: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Pending PM' },
    [INVOICE_STATUS.PM_REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'PM Rejected' },
    Submitted: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Submitted' },
};
const getStatus = (s) => STATUS_STYLES[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: s?.replace(/_/g, ' ') || '—' };

const DOC_TYPE_OPTIONS = ['INVOICE', 'TIMESHEET', 'RFP_COMMERCIAL', 'RINGI', 'ANNEX', 'OTHER'];

/* ─── Section wrapper ─────────────────────────────────────── */
function Section({ title, icon, children, accent = 'indigo' }) {
    const colors = { indigo: 'text-indigo-600 bg-indigo-50', emerald: 'text-emerald-600 bg-emerald-50', violet: 'text-violet-600 bg-violet-50', amber: 'text-amber-600 bg-amber-50', sky: 'text-sky-600 bg-sky-50' };
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
            <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function FinanceApprovalQueuePage() {
    const { user } = useAuth();
    const [allInvoices, setAllInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    // Review drawer state
    const [reviewInvoice, setReviewInvoice] = useState(null); // full invoice data
    const [reviewLoading, setReviewLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Approve / Reject action
    const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
    const [actionNotes, setActionNotes] = useState('');
    const [processingId, setProcessingId] = useState(null);

    // Inline document viewer (inside drawer)
    const [docViewer, setDocViewer] = useState(null); // { invoiceId, fileName, title }
    const [spreadsheetData, setSpreadsheetData] = useState(null);

    useEffect(() => {
        if (!docViewer) { setSpreadsheetData(null); return; }
        const ext = (docViewer.fileName || '').toLowerCase();
        const isSheet = ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.csv');
        if (!isSheet) { setSpreadsheetData(null); return; }
        let cancelled = false;
        (async () => {
            try {
                // docId = PM/FU uploaded doc; invoiceId = primary invoice
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

    // FU document upload
    const [fuDocs, setFuDocs] = useState([]); // uploaded docs for current invoice
    const [pmUploadedDocs, setPmUploadedDocs] = useState([]); // PM-added docs for current invoice (non-INVOICE type)
    const [uploadForm, setUploadForm] = useState({ file: null, type: 'RINGI', description: '' });
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchInvoices(); }, []);

    // Close drawer on Escape
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
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const openReview = async (inv) => {
        setDrawerOpen(true);
        setReviewInvoice(inv);
        setReviewLoading(true);
        setActionType(null);
        setActionNotes('');
        setFuDocs([]);
        setPmUploadedDocs([]);
        try {
            const pmQuery = `/api/pm/documents?invoiceId=${inv.id}${inv.assignedPM ? `&uploadedBy=${inv.assignedPM}` : ''}`;
            const [invRes, docsRes, pmDocsRes] = await Promise.all([
                fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' }),
                fetch(`/api/finance/documents?invoiceId=${inv.id}`, { cache: 'no-store' }),
                fetch(pmQuery, { cache: 'no-store' })
            ]);
            const invData = await invRes.json();
            const docsData = await docsRes.json();
            const pmDocsData = await pmDocsRes.json();
            if (invRes.ok) setReviewInvoice(invData);
            if (docsRes.ok) setFuDocs(docsData.documents || []);
            if (pmDocsRes.ok) setPmUploadedDocs(pmDocsData.documents || []);
        } catch (e) { console.error('Review fetch error', e); }
        finally { setReviewLoading(false); }
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setTimeout(() => { setReviewInvoice(null); setActionType(null); setActionNotes(''); }, 300);
    };

    const handleApprove = async () => {
        if (!reviewInvoice) return;
        try {
            setProcessingId(reviewInvoice.id);
            const res = await fetch(`/api/finance/approve/${reviewInvoice.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'APPROVE', notes: actionNotes })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccessMsg('Invoice approved for payment!');
            setTimeout(() => setSuccessMsg(null), 4000);
            closeDrawer();
            fetchInvoices();
        } catch (err) { setError(err.message); }
        finally { setProcessingId(null); }
    };

    const handleReject = async () => {
        if (!reviewInvoice) return;
        if (!actionNotes.trim()) { setError('Please provide a rejection reason.'); return; }
        try {
            setProcessingId(reviewInvoice.id);
            const res = await fetch(`/api/finance/approve/${reviewInvoice.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REJECT', notes: actionNotes })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccessMsg('Invoice rejected. Vendor notified.');
            setTimeout(() => setSuccessMsg(null), 4000);
            closeDrawer();
            fetchInvoices();
        } catch (err) { setError(err.message); }
        finally { setProcessingId(null); }
    };

    const handleUploadDoc = async () => {
        if (!uploadForm.file || !reviewInvoice) return;
        try {
            setUploading(true);
            const fd = new FormData();
            fd.append('file', uploadForm.file);
            fd.append('type', uploadForm.type);
            fd.append('description', uploadForm.description);
            fd.append('invoiceId', reviewInvoice.id);
            const res = await fetch('/api/finance/documents', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setFuDocs(prev => [data.document, ...prev]);
            setUploadForm({ file: null, type: 'RINGI', description: '' });
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (e) { setError(e.message); }
        finally { setUploading(false); }
    };

    // Tab filtering
    const filteredInvoices = useMemo(() => {
        switch (activeTab) {
            case 'pending': return allInvoices.filter(i => !i.financeApproval?.status || i.financeApproval?.status === 'PENDING');
            case 'approved': return allInvoices.filter(i => i.financeApproval?.status === 'APPROVED');
            case 'rejected': return allInvoices.filter(i => i.financeApproval?.status === 'REJECTED');
            case 'status': return allInvoices;
            default: return allInvoices;
        }
    }, [allInvoices, activeTab]);

    const pendingCount = allInvoices.filter(i => !i.financeApproval?.status || i.financeApproval?.status === 'PENDING').length;
    const approvedCount = allInvoices.filter(i => i.financeApproval?.status === 'APPROVED').length;
    const rejectedCount = allInvoices.filter(i => i.financeApproval?.status === 'REJECTED').length;

    const tabs = [
        { key: 'pending', label: 'Pending Review', count: pendingCount, icon: 'Clock', active: 'bg-indigo-50 text-indigo-700 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
        { key: 'approved', label: 'Approved', count: approvedCount, icon: 'CheckCircle2', active: 'bg-emerald-50 text-emerald-700 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
        { key: 'rejected', label: 'Rejected', count: rejectedCount, icon: 'XCircle', active: 'bg-rose-50 text-rose-700 border-rose-200', badge: 'bg-rose-100 text-rose-700' },
        { key: 'all', label: 'All', count: allInvoices.length, icon: 'LayoutList', active: 'bg-slate-100 text-slate-700 border-slate-200', badge: 'bg-slate-200 text-slate-700' },
        { key: 'status', label: 'Status', count: allInvoices.length, icon: 'Activity', active: 'bg-sky-50 text-sky-700 border-sky-200', badge: 'bg-sky-100 text-sky-700' },
    ];

    const isPending = (inv) => !inv?.financeApproval?.status || inv?.financeApproval?.status === 'PENDING';

    return (
        <div className="space-y-5 pb-10">
            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium">
                        <Icon name="AlertCircle" size={18} />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center"><Icon name="X" size={14} /></button>
                    </motion.div>
                )}
                {successMsg && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
                        <Icon name="CheckCircle2" size={18} />
                        <span>{successMsg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${activeTab === tab.key ? `${tab.active} shadow-sm` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-transparent'}`}>
                        <Icon name={tab.icon} size={16} />
                        {tab.label}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? tab.badge : 'bg-slate-100 text-slate-400'}`}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* ── Status Table Tab ── */}
            {activeTab === 'status' && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/60">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sky-600 bg-sky-50">
                            <Icon name="Activity" size={14} />
                        </div>
                        <h3 className="font-bold text-slate-700 text-sm">All Invoice Statuses</h3>
                        <span className="ml-auto text-[10px] font-bold text-slate-400">{allInvoices.length} invoice{allInvoices.length !== 1 ? 's' : ''}</span>
                    </div>
                    {loading ? (
                        <div className="p-10 text-center">
                            <div className="w-8 h-8 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto" />
                        </div>
                    ) : allInvoices.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-sm text-slate-400">No invoices in the queue yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[640px]">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="py-3 pl-5 text-left font-bold">Invoice</th>
                                        <th className="py-3 text-left font-bold">Vendor</th>
                                        <th className="py-3 text-left font-bold">Amount</th>
                                        <th className="py-3 text-center font-bold">PM Status</th>
                                        <th className="py-3 pr-5 text-center font-bold">Finance Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allInvoices.map((inv, i) => {
                                        const pmSt = inv.pmApproval?.status;
                                        const fuSt = inv.financeApproval?.status ||
                                            (inv.status === INVOICE_STATUS.FINANCE_APPROVED ? 'APPROVED' :
                                                inv.status === INVOICE_STATUS.PENDING_FINANCE_REVIEW ? 'PENDING' : null);

                                        const pmBadge = pmSt === 'APPROVED' ? 'bg-emerald-50 text-emerald-700'
                                            : pmSt === 'REJECTED' ? 'bg-rose-50 text-rose-700'
                                                : pmSt === 'INFO_REQUESTED' ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-slate-100 text-slate-500';
                                        const pmIcon = pmSt === 'APPROVED' ? 'CheckCircle2'
                                            : pmSt === 'REJECTED' ? 'XCircle'
                                                : pmSt === 'INFO_REQUESTED' ? 'RefreshCw' : 'Clock';
                                        const pmLabel = pmSt === 'APPROVED' ? 'Approved'
                                            : pmSt === 'REJECTED' ? 'Rejected'
                                                : pmSt === 'INFO_REQUESTED' ? 'Re-check Sent' : 'Pending';

                                        const fuBadge = fuSt === 'APPROVED' ? 'bg-emerald-50 text-emerald-700'
                                            : fuSt === 'REJECTED' ? 'bg-rose-50 text-rose-700'
                                                : fuSt === 'PENDING' ? 'bg-sky-50 text-sky-700'
                                                    : 'bg-slate-100 text-slate-400';
                                        const fuIcon = fuSt === 'APPROVED' ? 'CheckCircle2' : fuSt === 'REJECTED' ? 'XCircle' : 'Clock';
                                        const fuLabel = fuSt === 'APPROVED' ? 'Approved'
                                            : fuSt === 'REJECTED' ? 'Rejected'
                                                : fuSt === 'PENDING' ? 'Pending'
                                                    : pmSt === 'APPROVED' ? 'Pending' : 'Awaiting PM';

                                        return (
                                            <tr key={inv.id} className={`border-t border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                <td className="py-3 pl-5">
                                                    <p className="font-bold text-slate-800">{inv.invoiceNumber || inv.id?.slice(0, 10)}</p>
                                                    <p className="text-[10px] text-slate-400">{inv.date || '—'}</p>
                                                </td>
                                                <td className="py-3">
                                                    <p className="font-semibold text-slate-700">{inv.vendorName || '—'}</p>
                                                    {inv.vendorCode && <p className="text-[10px] font-mono text-violet-500">{inv.vendorCode}</p>}
                                                </td>
                                                <td className="py-3 font-black text-slate-800">{fmt(inv.amount)}</td>
                                                <td className="py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${pmBadge}`}>
                                                        <Icon name={pmIcon} size={10} /> {pmLabel}
                                                    </span>
                                                    {inv.pmApproval?.approvedAt && (
                                                        <p className="text-[9px] text-slate-400 mt-1">
                                                            {inv.pmApproval?.approvedByName || 'PM'} · {fmtDateTime(inv.pmApproval.approvedAt)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-5 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${fuBadge}`}>
                                                        <Icon name={fuIcon} size={10} /> {fuLabel}
                                                    </span>
                                                    {inv.financeApproval?.approvedAt && (
                                                        <p className="text-[9px] text-slate-400 mt-1">
                                                            {inv.financeApproval?.approvedByName || 'Finance'} · {fmtDateTime(inv.financeApproval.approvedAt)}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Invoice Cards */}
            {activeTab !== 'status' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
                            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm text-slate-400 font-medium">Loading approval queue...</p>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-white p-16 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                                <Icon name="Inbox" size={28} className="text-slate-300" />
                            </div>
                            <p className="text-base font-bold text-slate-400">{activeTab === 'pending' ? 'All caught up!' : 'No invoices here'}</p>
                            <p className="text-xs text-slate-300 mt-1">{activeTab === 'pending' ? 'No invoices pending your review.' : `No ${activeTab} invoices found.`}</p>
                        </div>
                    ) : (
                        filteredInvoices.map((inv, idx) => {
                            const sc = getStatus(inv.status);
                            const pending = isPending(inv);
                            const pmSc = PM_STATUS_MAP[inv.pmApproval?.status] || PM_STATUS_MAP.PENDING;
                            return (
                                <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                                    className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
                                    <div className="p-4 sm:p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                            {/* Left */}
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="w-11 h-11 rounded-xl bg-linear-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center font-bold text-indigo-600 text-xs shrink-0">
                                                    {inv.vendorName?.substring(0, 2).toUpperCase() || 'NA'}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-slate-800 text-sm">{inv.invoiceNumber || inv.id?.slice(0, 10)}</p>
                                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
                                                            <span className={`w-1 h-1 rounded-full ${sc.dot}`} />{sc.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                                                        <span className="font-semibold text-slate-600">{inv.vendorName || 'Unknown Vendor'}</span>
                                                        {inv.vendorCode && <><span>·</span><span className="font-mono text-indigo-500 font-semibold">{inv.vendorCode}</span></>}
                                                        {inv.date && <><span>·</span><span>{inv.date}</span></>}
                                                    </div>
                                                    {/* PM info strip */}
                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        {inv.assignedPMName && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                                <Icon name="User" size={10} /> PM: {inv.assignedPMName}
                                                            </span>
                                                        )}
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${pmSc.bg} ${pmSc.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${pmSc.dot}`} /> PM: {pmSc.label}
                                                        </span>
                                                        {inv.billingMonth && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                                <Icon name="Calendar" size={10} /> {inv.billingMonth}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right: Amount */}
                                            <div className="text-right shrink-0 pl-14 sm:pl-0">
                                                <p className="text-xl font-black text-slate-800">{fmt(inv.amount)}</p>
                                                {inv.basicAmount && <p className="text-[10px] text-slate-400">Basic: {fmt(inv.basicAmount)}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action bar */}
                                    <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                            {inv.originalName && (
                                                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                                    <Icon name="FileText" size={10} /> {inv.originalName}
                                                </span>
                                            )}
                                            {(inv.documents?.length > 0) && (
                                                <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                                    <Icon name="Paperclip" size={10} /> {inv.documents.length} attached
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => openReview(inv)}
                                            className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
                                            <Icon name="ClipboardList" size={14} />
                                            Review
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════
                REVIEW DRAWER – slides in from the right
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

                            {/* ── Drawer Header ── */}
                            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Review</p>
                                    <h2 className="font-black text-slate-800 text-lg leading-tight">
                                        {reviewInvoice?.invoiceNumber || reviewInvoice?.id?.slice(0, 12) || '…'}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {reviewInvoice && (
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg ${getStatus(reviewInvoice?.status).bg} ${getStatus(reviewInvoice?.status).text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatus(reviewInvoice?.status).dot}`} />
                                            {getStatus(reviewInvoice?.status).label}
                                        </span>
                                    )}
                                    <button onClick={closeDrawer}
                                        className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* ── Drawer Body ── */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {reviewLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <p className="text-sm text-slate-400 font-medium">Loading invoice details…</p>
                                    </div>
                                ) : reviewInvoice ? (
                                    <>
                                        {/* 1. Vendor Details */}
                                        <Section title="Vendor Details" icon="Building2" accent="indigo">
                                            <div className="grid grid-cols-2 gap-4">
                                                <KV label="Vendor Name" value={reviewInvoice.vendorName} />
                                                <KV label="Vendor Code" value={reviewInvoice.vendorCode} mono />
                                                <KV label="Invoice No." value={reviewInvoice.invoiceNumber} mono />
                                                <KV label="Invoice Date" value={reviewInvoice.invoiceDate || reviewInvoice.date} />
                                                <KV label="Billing Month" value={reviewInvoice.billingMonth} />
                                            </div>
                                        </Section>

                                        {/* 2. Invoice Financials */}
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

                                        {/* 3. PM Review Status */}
                                        <Section title="PM Review" icon="UserCheck" accent="violet">
                                            {(() => {
                                                const pmSc = PM_STATUS_MAP[reviewInvoice.pmApproval?.status] || PM_STATUS_MAP.PENDING;
                                                const seen = new Set();
                                                const dedupedPmDocs = pmUploadedDocs
                                                    .filter(d => d.type !== 'INVOICE')
                                                    .filter(d => { const k = `${d.type}|${d.fileName}`; if (seen.has(k)) return false; seen.add(k); return true; });
                                                return (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Project Manager</p>
                                                                <p className="font-bold text-slate-800">{reviewInvoice.assignedPMName || reviewInvoice.assignedPM || '—'}</p>
                                                            </div>
                                                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${pmSc.bg} ${pmSc.text}`}>
                                                                <span className={`w-2 h-2 rounded-full ${pmSc.dot}`} />
                                                                {pmSc.label}
                                                            </span>
                                                        </div>
                                                        {reviewInvoice.pmApproval?.approvedAt && (
                                                            <p className="text-xs text-slate-400">{reviewInvoice.pmApproval?.approvedByName || 'PM'} · {fmtDateTime(reviewInvoice.pmApproval.approvedAt)}</p>
                                                        )}
                                                        {reviewInvoice.pmApproval?.notes && (
                                                            <div className={`rounded-xl p-3 border text-sm ${pmSc.bg} ${pmSc.text} border-current/10`}>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">PM Notes</p>
                                                                <p className="font-medium">{reviewInvoice.pmApproval.notes}</p>
                                                            </div>
                                                        )}
                                                        {dedupedPmDocs.length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Documents Added by PM</p>
                                                                <div className="space-y-1.5">
                                                                    {dedupedPmDocs.map((doc, i) => (
                                                                        <div key={doc.id || i} className="flex items-center justify-between p-2.5 bg-violet-50 rounded-xl border border-violet-100">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                                                    <Icon name="File" size={13} />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-slate-700 truncate">{doc.fileName || `Document ${i + 1}`}</p>
                                                                                    <p className="text-[10px] text-slate-400">{doc.type}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                <button onClick={() => setDocViewer({ docId: doc.id, fileName: doc.fileName, title: doc.type })}
                                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-violet-200 text-violet-600 text-[10px] font-bold hover:bg-violet-50 transition-all inline-flex items-center gap-1">
                                                                                    <Icon name="Eye" size={10} /> View
                                                                                </button>
                                                                                <a href={`/api/documents/${doc.id}/file`} download={doc.fileName || doc.id}
                                                                                    className="h-6 px-2.5 rounded-lg bg-white border border-violet-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                                    <Icon name="Download" size={10} /> Download
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </Section>

                                        {/* 4. Vendor Documents */}
                                        <Section title="Vendor Documents" icon="Paperclip" accent="amber">
                                            <div className="space-y-2">
                                                {/* Primary Invoice File */}
                                                {reviewInvoice.fileUrl || reviewInvoice.originalName ? (
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
                                                            <button
                                                                onClick={() => setDocViewer({ invoiceId: reviewInvoice.id, fileName: reviewInvoice.originalName, title: reviewInvoice.originalName || 'Invoice Document' })}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-indigo-600 text-[10px] font-bold hover:bg-indigo-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Eye" size={11} /> View
                                                            </button>
                                                            <a href={`/api/invoices/${reviewInvoice.id}/file`} download={reviewInvoice.originalName || 'invoice'}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Download" size={11} /> Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 italic">No primary invoice file.</p>
                                                )}

                                                {/* Additional Documents (timesheet, annex, etc.) */}
                                                {reviewInvoice.documents?.length > 0 && reviewInvoice.documents.map((doc, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                                <Icon name="File" size={14} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{doc.fileName || doc.documentId || `Document ${i + 1}`}</p>
                                                                <p className="text-[10px] text-slate-400">{doc.type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => setDocViewer({ docId: doc.documentId, fileName: doc.fileName || doc.documentId, title: doc.type })}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-violet-600 text-[10px] font-bold hover:bg-violet-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Eye" size={11} /> View
                                                            </button>
                                                            <a href={`/api/documents/${doc.documentId}/file`} download={doc.fileName || doc.documentId}
                                                                className="h-7 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1">
                                                                <Icon name="Download" size={11} /> Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                                {!reviewInvoice.fileUrl && !reviewInvoice.originalName && (!reviewInvoice.documents || reviewInvoice.documents.length === 0) && (
                                                    <p className="text-xs text-slate-400 italic text-center py-3">No documents attached by vendor.</p>
                                                )}
                                            </div>
                                        </Section>

                                        {/* 5. FU Document Upload Table */}
                                        <Section title="Finance Team Documents" icon="Upload" accent="sky">
                                            {/* Existing FU docs table */}
                                            {fuDocs.length > 0 ? (
                                                <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest">
                                                                <th className="py-2 pl-3 text-left font-bold w-8">S.No</th>
                                                                <th className="py-2 text-left font-bold">Type of Doc</th>
                                                                <th className="py-2 text-left font-bold">File Name</th>
                                                                <th className="py-2 text-left font-bold">Description</th>
                                                                <th className="py-2 pr-3 text-center font-bold">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {fuDocs.map((doc, i) => (
                                                                <tr key={doc.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                                                                    <td className="py-2 pl-3 text-slate-400 font-mono font-bold">{i + 1}</td>
                                                                    <td className="py-2">
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md">{doc.type}</span>
                                                                    </td>
                                                                    <td className="py-2 text-slate-700 font-medium max-w-[120px] truncate">{doc.fileName}</td>
                                                                    <td className="py-2 text-slate-500 max-w-[120px] truncate">{doc.metadata?.description || '—'}</td>
                                                                    <td className="py-2 pr-3 text-center">
                                                                        <a href={doc.fileUrl} download={doc.fileName}
                                                                            className="inline-flex items-center gap-1 h-6 px-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all">
                                                                            <Icon name="Download" size={10} />
                                                                        </a>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic mb-4">No documents uploaded by finance team yet.</p>
                                            )}

                                            {/* Upload form */}
                                            <div className="bg-sky-50/60 rounded-xl border border-sky-100 p-4 space-y-3">
                                                <p className="text-[11px] font-bold text-sky-700 uppercase tracking-widest">Upload New Document</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Type of Document</label>
                                                        <select value={uploadForm.type} onChange={e => setUploadForm(p => ({ ...p, type: e.target.value }))}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400">
                                                            {DOC_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Description</label>
                                                        <input type="text" value={uploadForm.description}
                                                            onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                                                            placeholder="Brief description…"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input ref={fileInputRef} type="file"
                                                        onChange={e => setUploadForm(p => ({ ...p, file: e.target.files[0] || null }))}
                                                        className="flex-1 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:bg-sky-600 file:text-white file:text-[11px] file:font-bold file:border-0 file:cursor-pointer cursor-pointer" />
                                                    <button onClick={handleUploadDoc} disabled={!uploadForm.file || uploading}
                                                        className="h-8 px-4 rounded-lg bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0">
                                                        {uploading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Upload" size={13} />}
                                                        Upload
                                                    </button>
                                                </div>
                                            </div>
                                        </Section>

                                        {/* 6. Notes / Vendor Notes */}
                                        {reviewInvoice.notes && (
                                            <Section title="Vendor Notes" icon="MessageSquare" accent="amber">
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{reviewInvoice.notes}</p>
                                            </Section>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400 text-center py-20">No invoice selected.</p>
                                )}
                            </div>

                            {/* ── Drawer Footer: Actions ── */}
                            {reviewInvoice && isPending(reviewInvoice) && (
                                <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
                                    {actionType === null ? (
                                        <div className="flex gap-3">
                                            <button onClick={() => setActionType('reject')}
                                                className="flex-1 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center justify-center gap-2">
                                                <Icon name="XCircle" size={16} /> Reject Invoice
                                            </button>
                                            <button onClick={() => setActionType('approve')}
                                                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-200">
                                                <Icon name="CheckCircle2" size={16} /> Approve for Payment
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className={`flex items-center gap-2 p-3 rounded-xl ${actionType === 'approve' ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                                                <Icon name={actionType === 'approve' ? 'CheckCircle2' : 'XCircle'} size={16} className={actionType === 'approve' ? 'text-emerald-600' : 'text-rose-600'} />
                                                <p className={`text-sm font-bold ${actionType === 'approve' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {actionType === 'approve' ? 'Approving invoice for payment' : 'Rejecting this invoice'}
                                                </p>
                                            </div>
                                            <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)} rows={2}
                                                placeholder={actionType === 'approve' ? 'Add notes (optional)…' : 'Reason for rejection (required)…'}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
                                            <div className="flex gap-2">
                                                <button onClick={() => { setActionType(null); setActionNotes(''); }}
                                                    className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                                                    Cancel
                                                </button>
                                                <button onClick={actionType === 'approve' ? handleApprove : handleReject}
                                                    disabled={!!processingId || (actionType === 'reject' && !actionNotes.trim())}
                                                    className={`flex-1 h-10 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                                    {processingId ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name={actionType === 'approve' ? 'CheckCircle2' : 'XCircle'} size={15} />}
                                                    Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Already decided badge */}
                            {reviewInvoice && !isPending(reviewInvoice) && (
                                <div className="border-t border-slate-200 bg-white px-6 py-4 shrink-0">
                                    <div className={`flex items-center gap-2 p-3 rounded-xl ${reviewInvoice.financeApproval?.status === 'APPROVED' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
                                        <Icon name={reviewInvoice.financeApproval?.status === 'APPROVED' ? 'CheckCircle2' : 'XCircle'} size={16} />
                                        <div>
                                            <span className="text-sm font-bold">
                                                {reviewInvoice.financeApproval?.status === 'APPROVED' ? 'This invoice was approved for payment' : 'This invoice was rejected'}
                                            </span>
                                            {reviewInvoice.financeApproval?.approvedAt && (
                                                <p className="text-[10px] opacity-70 mt-0.5">
                                                    by {reviewInvoice.financeApproval?.approvedByName || 'Finance'} · {fmtDateTime(reviewInvoice.financeApproval.approvedAt)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════════
                INLINE DOCUMENT VIEWER MODAL (inside drawer)
            ══════════════════════════════════════════════ */}
            <AnimatePresence>
                {docViewer && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4"
                        onClick={() => setDocViewer(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">{docViewer.title || 'Document'}</h3>
                                    <p className="text-[10px] text-slate-400">{reviewInvoice?.vendorName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={docViewer.docId ? `/api/documents/${docViewer.docId}/file` : `/api/invoices/${docViewer.invoiceId}/file`}
                                        download={docViewer.fileName || 'document'}
                                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-violet-50 hover:text-violet-600 transition-all inline-flex items-center gap-1.5">
                                        <Icon name="Download" size={14} /> Download
                                    </a>
                                    <button onClick={() => setDocViewer(null)}
                                        className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>
                            {/* Viewer */}
                            <div className="flex-1 bg-slate-100 relative min-h-0 overflow-y-auto" style={{ minHeight: '60vh' }}>
                                <DocumentViewer
                                    invoiceId={docViewer.invoiceId}
                                    fileName={docViewer.fileName}
                                    spreadsheetData={spreadsheetData}
                                    customFileUrl={docViewer.docId ? `/api/documents/${docViewer.docId}/file` : null}
                                    forceSpreadsheet={docViewer.title === 'TIMESHEET'}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
