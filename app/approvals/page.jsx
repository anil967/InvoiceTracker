'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROLES, getNormalizedRole } from '@/constants/roles';
import DocumentViewer from '@/components/ui/DocumentViewer';

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_MAP = {
  'Submitted': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Submitted' },
  'Pending PM Approval': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Pending PM' },
  'PM Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'PM Approved' },
  'PM Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'PM Rejected' },
  'More Info Needed': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'More Info Needed' },
  'Pending Dept Head Review': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', label: 'Pending Dept Head' },
  'Dept Head Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Dept Head Rejected' },
  'Pending Div Head Review': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Pending Div Head' },
  'Div Head Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Div Head Approved' },
  'Div Head Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Div Head Rejected' },
  // Legacy statuses (kept for backward compat)
  'Pending Finance Review': { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Pending Finance (Legacy)' },
  'Finance Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Finance Approved (Legacy)' },
  'Finance Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Finance Rejected (Legacy)' },
};
const getStatus = (s) => STATUS_MAP[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: s?.replace(/_/g, ' ') || '—' };

const APPROVAL_STATUS_MAP = {
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Rejected' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  INFO_REQUESTED: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Info Requested' },
};
const getApprovalStatus = (s) => {
  if (['APPROVED', 'Finance Approved', 'PM Approved'].includes(s)) return APPROVAL_STATUS_MAP.APPROVED;
  if (['REJECTED', 'Finance Rejected', 'PM Rejected'].includes(s)) return APPROVAL_STATUS_MAP.REJECTED;
  if (['INFO_REQUESTED', 'More Info Needed'].includes(s)) return APPROVAL_STATUS_MAP.INFO_REQUESTED;
  if (['Pending Finance Review'].includes(s)) return APPROVAL_STATUS_MAP.PENDING; // Still pending for finance
  return APPROVAL_STATUS_MAP[s] || APPROVAL_STATUS_MAP.PENDING;
};

/* ─── Section wrapper ─────────────────────────────────────── */
function Section({ title, icon, children, accent = 'amber' }) {
  const colors = {
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    violet: 'text-violet-600 bg-violet-50',
    sky: 'text-sky-600 bg-sky-50',
    rose: 'text-rose-600 bg-rose-50',
  };
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

/* ─── Doc Pill ────────────────────────────────────────────── */
function DocRow({ doc, i, onView, accentColor = 'violet' }) {
  return (
    <div className={`flex items-center justify-between p-2.5 bg-${accentColor}-50 rounded-xl border border-${accentColor}-100`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-7 h-7 rounded-lg bg-${accentColor}-100 text-${accentColor}-600 flex items-center justify-center shrink-0`}>
          <Icon name="File" size={13} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700 truncate">{doc.fileName || `Document ${i + 1}`}</p>
          <p className="text-[10px] text-slate-400">{doc.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onView(doc)}
          className={`h-6 px-2.5 rounded-lg bg-white border border-${accentColor}-200 text-${accentColor}-600 text-[10px] font-bold hover:bg-${accentColor}-50 transition-all inline-flex items-center gap-1`}>
          <Icon name="Eye" size={10} /> View
        </button>
        <a href={`/api/documents/${doc.id}/file`} download={doc.fileName || doc.id}
          className={`h-6 px-2.5 rounded-lg bg-white border border-${accentColor}-200 text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-1`}>
          <Icon name="Download" size={10} /> Download
        </a>
      </div>
    </div>
  );
}

/* ─── TABS config ─────────────────────────────────────────── */
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'vendor', label: 'Vendor Stage', statuses: ['Submitted'] },
  { key: 'pm', label: 'PM Review', statuses: ['Pending PM Approval', 'More Info Needed'] },
  { key: 'depthead', label: 'Dept Head Review', statuses: ['Pending Dept Head Review', 'Dept Head Rejected'] },
  { key: 'divhead', label: 'Div Head Review', statuses: ['Pending Div Head Review'] },
  { key: 'approved', label: 'Fully Approved', statuses: ['Div Head Approved', 'Finance Approved'] },
  { key: 'rejected', label: 'Rejected', statuses: ['PM Rejected', 'Dept Head Rejected', 'Div Head Rejected', 'Finance Rejected'] },
];

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function AdminApprovalsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400">Loading...</div>}>
      <AdminApprovalsContent />
    </Suspense>
  );
}

function AdminApprovalsContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  /* Drawer state */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewInvoice, setReviewInvoice] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [pmDocs, setPmDocs] = useState([]);
  const [deptDocs, setDeptDocs] = useState([]);
  const [divDocs, setDivDocs] = useState([]);

  /* Doc viewer */
  const [docViewer, setDocViewer] = useState(null);
  const [spreadsheetData, setSpreadsheetData] = useState(null);

  /* Auto-refresh polling */
  const pollIntervalRef = useRef(null);
  const POLL_INTERVAL = 8000; // 8 seconds

  /* Auth guard */
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user) {
      const role = getNormalizedRole(user);
      if (role !== ROLES.ADMIN) router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  /* Escape key */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (docViewer) setDocViewer(null); else closeDrawer(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [docViewer]);

  /* Spreadsheet effect */
  useEffect(() => {
    if (!docViewer) { setSpreadsheetData(null); return; }
    const ext = (docViewer.fileName || '').toLowerCase();
    const isSheet = ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.csv');
    if (!isSheet && !docViewer.forceSpreadsheet) { setSpreadsheetData(null); return; }
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

  /* Fetch invoices with auto-refresh */
  const fetchInvoices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/invoices?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      setAllInvoices(Array.isArray(data) ? data : (data.invoices || []));
    } catch (e) {
      if (!silent) console.error('Failed to fetch invoices:', e);
    }
    finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    fetchInvoices();

    // Set up auto-refresh polling
    pollIntervalRef.current = setInterval(() => {
      fetchInvoices(true); // Silent refresh
    }, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  /* Tab filtering */
  const tab = TABS.find(t => t.key === activeTab);
  const filtered = allInvoices
    .filter(inv => !tab.statuses || tab.statuses.includes(inv.status))
    .filter(inv => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.vendorName?.toLowerCase().includes(q) ||
        inv.id?.toLowerCase().includes(q);
    });

  /* Tab counts */
  const counts = {};
  TABS.forEach(t => {
    counts[t.key] = t.statuses
      ? allInvoices.filter(inv => t.statuses.includes(inv.status)).length
      : allInvoices.length;
  });

  /* Open drawer */
  const openReview = async (inv) => {
    setDrawerOpen(true);
    setReviewInvoice(inv);
    setReviewLoading(true);
    setPmDocs([]);
    setDeptDocs([]);
    setDivDocs([]);
    try {
      const pmQuery = `/api/pm/documents?invoiceId=${inv.id}&uploadedByRole=PM`;
      const deptQuery = `/api/dept-head/documents?invoiceId=${inv.id}&uploadedByRole=Department+Head`;
      const divQuery = `/api/div-head/documents?invoiceId=${inv.id}&uploadedByRole=Divisional+Head`;
      const [invRes, pmRes, deptRes, divRes] = await Promise.all([
        fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' }),
        fetch(pmQuery, { cache: 'no-store' }),
        fetch(deptQuery, { cache: 'no-store' }),
        fetch(divQuery, { cache: 'no-store' }),
      ]);
      const invData = await invRes.json();
      const pmData = await pmRes.json();
      const deptData = await deptRes.json();
      const divData = await divRes.json();
      if (invRes.ok) setReviewInvoice(invData);
      if (pmRes.ok) {
        const seen = new Set();
        const deduped = (pmData.documents || [])
          .filter(d => { const k = `${d.type}|${d.fileName}`; if (seen.has(k)) return false; seen.add(k); return true; });
        setPmDocs(deduped);
      }
      if (deptRes.ok) {
        const seen = new Set();
        const deduped = (deptData.documents || [])
          .filter(d => { const k = `${d.type}|${d.fileName}`; if (seen.has(k)) return false; seen.add(k); return true; });
        setDeptDocs(deduped);
      }
      if (divRes.ok) {
        const seen = new Set();
        const deduped = (divData.documents || [])
          .filter(d => { const k = `${d.type}|${d.fileName}`; if (seen.has(k)) return false; seen.add(k); return true; });
        setDivDocs(deduped);
      }
    } catch (e) { console.error(e); }
    finally { setReviewLoading(false); }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => { setReviewInvoice(null); setDocViewer(null); }, 300);
  };

  const handleViewDoc = (doc) => setDocViewer({
    docId: doc.id,
    fileName: doc.fileName,
    title: doc.type,
    forceSpreadsheet: doc.type === 'TIMESHEET',
  });

  /* ── Render ── */
  return (
    <div className="min-h-screen">
      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
              <Icon name="ShieldCheck" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">Approval Workflow Tracker</h1>
              <p className="text-xs text-slate-400">Real-time tracking of invoice approvals across all stages</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInvoices()}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
              title="Refresh invoices"
            >
              <Icon name="RefreshCw" size={12} /> Refresh
            </button>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-6 gap-3 mt-5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`rounded-2xl p-4 text-center transition-all border ${activeTab === t.key ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200' : 'bg-white border-slate-100 hover:border-amber-200'}`}>
              <p className={`text-2xl font-black ${activeTab === t.key ? 'text-white' : 'text-slate-800'}`}>{counts[t.key]}</p>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${activeTab === t.key ? 'text-amber-100' : 'text-slate-400'}`}>{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-4">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by invoice number, vendor name, or ID…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-slate-400"
        />
      </div>

      {/* ── Tab strip ── */}
      <div className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === t.key ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${activeTab === t.key ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* ── Invoice List ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading invoices…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-100">
          <Icon name="CheckCircle" size={40} className="text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">No invoices found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different tab or search term</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="py-3 pl-5 text-left">Invoice</th>
                <th className="py-3 text-left">Vendor</th>
                <th className="py-3 text-left">Assigned PM</th>
                <th className="py-3 text-left">PM Status</th>
                <th className="py-3 text-left">Dept Head Status</th>
                <th className="py-3 text-left">Div Head Status</th>
                <th className="py-3 text-right">Amount</th>
                <th className="py-3 pr-5 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const sc = getStatus(inv.status);
                const pmSc = getApprovalStatus(inv.pmApproval?.status);
                const dhSc = getApprovalStatus(inv.deptHeadApproval?.status);
                const dvSc = getApprovalStatus(inv.divHeadApproval?.status);
                return (
                  <tr key={inv.id}
                    onClick={() => openReview(inv)}
                    className={`border-t border-slate-50 cursor-pointer transition-colors hover:bg-amber-50/40 ${reviewInvoice?.id === inv.id && drawerOpen ? 'bg-amber-50' : ''}`}>
                    <td className="py-3 pl-5">
                      <p className="font-bold text-slate-800 text-xs">{inv.invoiceNumber || inv.id}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{inv.originalName || '—'}</p>
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-700 text-xs">{inv.vendorName}</p>
                      {inv.vendorCode && <p className="text-[10px] text-slate-400 font-mono">{inv.vendorCode}</p>}
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-slate-600">{inv.assignedPMName || inv.assignedPM || '—'}</p>
                    </td>
                    {/* PM Status */}
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${pmSc.bg} ${pmSc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pmSc.dot}`} />{pmSc.label}
                      </span>
                      {inv.pmApproval?.approvedAt && (
                        <div className="mt-1">
                          <p className="text-[9px] text-slate-400 leading-tight">
                            {inv.pmApproval?.approvedByName || 'PM'} · {fmtDateTime(inv.pmApproval.approvedAt)}
                          </p>
                        </div>
                      )}
                    </td>
                    {/* Dept Head Status */}
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${dhSc.bg} ${dhSc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dhSc.dot}`} />{dhSc.label}
                      </span>
                      {inv.deptHeadApproval?.approvedAt && (
                        <div className="mt-1">
                          <p className="text-[9px] text-slate-400 leading-tight">
                            {inv.deptHeadApproval?.approvedByName || 'Dept Head'} · {fmtDateTime(inv.deptHeadApproval.approvedAt)}
                          </p>
                        </div>
                      )}
                    </td>
                    {/* Div Head Status */}
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${dvSc.bg} ${dvSc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dvSc.dot}`} />{dvSc.label}
                      </span>
                      {inv.divHeadApproval?.approvedAt && (
                        <div className="mt-1">
                          <p className="text-[9px] text-slate-400 leading-tight">
                            {inv.divHeadApproval?.approvedByName || 'Div Head'} · {fmtDateTime(inv.divHeadApproval.approvedAt)}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800 text-xs">{fmt(inv.amount)}</td>
                    <td className="py-3 pr-5 text-right text-[10px] text-slate-400">{fmtDate(inv.receivedAt || inv.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════
                REVIEW DRAWER
            ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={closeDrawer}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-slate-50 shadow-2xl z-50 flex flex-col">

              {/* ── Drawer Header ── */}
              <div className="px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Review</p>
                    <h2 className="font-black text-slate-800 text-lg">{reviewInvoice?.invoiceNumber || reviewInvoice?.id || '—'}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {reviewInvoice && (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${getStatus(reviewInvoice.status).bg} ${getStatus(reviewInvoice.status).text}`}>
                        <span className={`w-2 h-2 rounded-full ${getStatus(reviewInvoice.status).dot}`} />
                        {getStatus(reviewInvoice.status).label}
                      </span>
                    )}
                    <button onClick={closeDrawer}
                      className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                      <Icon name="X" size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Drawer Body ── */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
                {reviewLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading…</p>
                  </div>
                ) : reviewInvoice ? (
                  <>
                    {/* 1. Vendor Details */}
                    <Section title="Vendor Details" icon="Building2" accent="amber">
                      <div className="grid grid-cols-2 gap-4">
                        <KV label="Vendor Name" value={reviewInvoice.vendorName} />
                        <KV label="Vendor ID / Code" value={reviewInvoice.vendorCode || reviewInvoice.vendorId} mono />
                        <KV label="Invoice Number" value={reviewInvoice.invoiceNumber} mono />
                        <KV label="PO Number" value={reviewInvoice.poNumber} mono />
                        <KV label="Submitted" value={fmtDate(reviewInvoice.receivedAt)} />
                      </div>
                    </Section>

                    {/* 2. Vendor Documents */}
                    <Section title="Vendor Documents" icon="Paperclip" accent="indigo">
                      <div className="space-y-2">
                        {/* Primary invoice file */}
                        {(reviewInvoice.fileUrl || reviewInvoice.originalName) ? (
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
                        {/* Additional vendor docs (Annex, Timesheet, etc.) */}
                        {reviewInvoice.documents?.map((doc, i) => (
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
                              <button onClick={() => setDocViewer({ docId: doc.documentId, fileName: doc.fileName || doc.documentId, title: doc.type, forceSpreadsheet: doc.type === 'TIMESHEET' })}
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


                    {/* 3. PM Review */}
                    <Section title="PM Review" icon="UserCheck" accent="violet">
                      {(() => {
                        const pmSc = getApprovalStatus(reviewInvoice.pmApproval?.status);
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
                            {pmDocs.length > 0 && (
                              <div className="mt-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Documents Added by PM</p>
                                <div className="space-y-1.5">
                                  {pmDocs.map((doc, i) => (
                                    <DocRow key={doc.id || i} doc={doc} i={i} onView={handleViewDoc} accentColor="violet" />
                                  ))}
                                </div>
                              </div>
                            )}
                            {pmDocs.length === 0 && !reviewInvoice.pmApproval?.notes && (!reviewInvoice.pmApproval?.status || reviewInvoice.pmApproval?.status === 'PENDING') && (
                              <p className="text-xs text-slate-400 italic">No PM review yet.</p>
                            )}
                          </div>
                        );
                      })()}
                    </Section>

                    {/* 4. Dept Head Review */}
                    <Section title="Department Head Review" icon="Building2" accent="sky">
                      {(() => {
                        const dhSc = getApprovalStatus(reviewInvoice.deptHeadApproval?.status);
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Department Head</p>
                                <p className="font-bold text-slate-800">{reviewInvoice.deptHeadApproval?.approvedByName || reviewInvoice.assignedDeptHead || '—'}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${dhSc.bg} ${dhSc.text}`}>
                                <span className={`w-2 h-2 rounded-full ${dhSc.dot}`} />
                                {dhSc.label}
                              </span>
                            </div>
                            {reviewInvoice.deptHeadApproval?.approvedAt && (
                              <p className="text-xs text-slate-400">{reviewInvoice.deptHeadApproval?.approvedByName || 'Dept Head'} · {fmtDateTime(reviewInvoice.deptHeadApproval.approvedAt)}</p>
                            )}
                            {reviewInvoice.deptHeadApproval?.notes && (
                              <div className={`rounded-xl p-3 border text-sm ${dhSc.bg} ${dhSc.text} border-current/10`}>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Dept Head Notes</p>
                                <p className="font-medium">{reviewInvoice.deptHeadApproval.notes}</p>
                              </div>
                            )}
                            {deptDocs.length > 0 && (
                              <div className="mt-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Documents Added by Dept Head</p>
                                <div className="space-y-1.5">
                                  {deptDocs.map((doc, i) => (
                                    <DocRow key={doc.id || i} doc={doc} i={i} onView={handleViewDoc} accentColor="sky" />
                                  ))}
                                </div>
                              </div>
                            )}
                            {deptDocs.length === 0 && !reviewInvoice.deptHeadApproval?.notes && (
                              <p className="text-xs text-slate-400 italic">No Dept Head review yet.</p>
                            )}
                          </div>
                        );
                      })()}
                    </Section>

                    {/* 5. Div Head Review */}
                    <Section title="Divisional Head Review" icon="BadgeCheck" accent="indigo">
                      {(() => {
                        const dvSc = getApprovalStatus(reviewInvoice.divHeadApproval?.status);
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Divisional Head</p>
                                <p className="font-bold text-slate-800">{reviewInvoice.divHeadApproval?.approvedByName || reviewInvoice.assignedDivHead || '—'}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${dvSc.bg} ${dvSc.text}`}>
                                <span className={`w-2 h-2 rounded-full ${dvSc.dot}`} />
                                {dvSc.label}
                              </span>
                            </div>
                            {reviewInvoice.divHeadApproval?.approvedAt && (
                              <p className="text-xs text-slate-400">{reviewInvoice.divHeadApproval?.approvedByName || 'Div Head'} · {fmtDateTime(reviewInvoice.divHeadApproval.approvedAt)}</p>
                            )}
                            {reviewInvoice.divHeadApproval?.notes && (
                              <div className={`rounded-xl p-3 border text-sm ${dvSc.bg} ${dvSc.text} border-current/10`}>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Div Head Notes</p>
                                <p className="font-medium">{reviewInvoice.divHeadApproval.notes}</p>
                              </div>
                            )}
                            {divDocs.length > 0 && (
                              <div className="mt-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Documents Added by Div Head</p>
                                <div className="space-y-1.5">
                                  {divDocs.map((doc, i) => (
                                    <DocRow key={doc.id || i} doc={doc} i={i} onView={handleViewDoc} accentColor="indigo" />
                                  ))}
                                </div>
                              </div>
                            )}
                            {divDocs.length === 0 && !reviewInvoice.divHeadApproval?.notes && (
                              <p className="text-xs text-slate-400 italic">No Div Head review yet.</p>
                            )}
                          </div>
                        );
                      })()}
                    </Section>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-20">No invoice selected.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════
                DOCUMENT VIEWER MODAL
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
                    className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-amber-50 hover:text-amber-600 transition-all inline-flex items-center gap-1.5">
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