"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Icon from "@/components/Icon";
import LifecycleProgressTracker from "@/components/Lifecycle/LifecycleProgressTracker";
import { getVendorDashboardData } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getNormalizedRole, ROLES } from "@/constants/roles";
import { INVOICE_STATUS } from "@/lib/invoice-workflow";
import DocumentViewer from "@/components/ui/DocumentViewer";
import clsx from "clsx";
import PageHeader from "@/components/Layout/PageHeader";
import ActiveRates from "@/components/Vendor/ActiveRates";

export default function VendorPortal() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading vendor portal...</div>}>
            <VendorPortalContent />
        </Suspense>
    );
}

function VendorPortalContent() {
    const router = useRouter();
    const { user, logout, isLoading: authLoading } = useAuth();
    const logoutRef = useRef(logout);
    logoutRef.current = logout;
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [rateCards, setRateCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [unreadRecheckCount, setUnreadRecheckCount] = useState(0);
    const fetchIdRef = useRef(0);

    const fetchSubmissions = useCallback(async () => {
        const thisFetchId = ++fetchIdRef.current;
        try {
            const data = await getVendorDashboardData();
            // If component unmounted or new fetch started, ignore result
            if (thisFetchId !== fetchIdRef.current) return;

            // Vendor API returns { stats: {...}, invoices: [...], rateCards: { rateCards: [...] } }
            const invoiceList = Array.isArray(data) ? data : (data?.invoices || []);
            const rateCardList = data?.rateCards?.rateCards || [];
            setAllSubmissions(invoiceList);
            setRateCards(rateCardList);
        } catch (e) {
            console.error("Failed to fetch vendor submissions", e);
            if (thisFetchId !== fetchIdRef.current) return;
            if (e?.message === "Unauthorized") logoutRef.current?.();
        } finally {
            if (thisFetchId === fetchIdRef.current) setLoading(false);
        }
    }, []);

    // PM Selection State — PM list = all signed-up project managers
    const [pms, setPms] = useState([]);
    const [selectedPM, setSelectedPM] = useState("");
    const [vendorProfile, setVendorProfile] = useState(null); // { vendorCode, name } for display

    // OCR auto-fill state
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrInvoiceNumber, setOcrInvoiceNumber] = useState('');
    const [ocrInvoiceDate, setOcrInvoiceDate] = useState('');
    const [ocrBasicAmount, setOcrBasicAmount] = useState('');
    const [ocrTotalAmount, setOcrTotalAmount] = useState('');
    const [ocrTaxType, setOcrTaxType] = useState('');
    const [ocrHsnCode, setOcrHsnCode] = useState('');

    // Upload indicator state
    const [rfpFileName, setRfpFileName] = useState('');
    const [commercialFileName, setCommercialFileName] = useState('');

    // Disclaimer checkbox state
    const [disclaimerChecked, setDisclaimerChecked] = useState(false);

    const resetOcrFields = useCallback(() => {
        setOcrInvoiceNumber('');
        setOcrInvoiceDate('');
        setOcrBasicAmount('');
        setOcrTotalAmount('');
        setOcrTaxType('');
        setOcrHsnCode('');
    }, []);

    const handleInvoiceFileChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) { setSelectedFile(null); return; }

        // Strict PDF-only check
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Only PDF files are supported. Please upload a PDF invoice.');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        resetOcrFields();

        // Trigger OCR extraction
        setOcrLoading(true);
        const ocrToast = toast.loading('Extracting invoice data via OCR...');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/ocr', { method: 'POST', body: formData });
            const result = await res.json();

            if (res.ok && result.success && result.data) {
                const d = result.data;
                // Show 'null' for fields not found in the invoice
                setOcrInvoiceNumber(d.invoiceNumber ?? 'null');
                setOcrInvoiceDate(d.invoiceDate ?? '');
                setOcrBasicAmount(d.basicAmount != null ? String(d.basicAmount) : 'null');
                setOcrTotalAmount(d.totalAmount != null ? String(d.totalAmount) : 'null');
                setOcrTaxType(d.taxType ?? '');
                setOcrHsnCode(d.hsnCode ?? 'null');
                toast.success('Invoice fields auto-filled from OCR!', { id: ocrToast });
            } else {
                toast.error(result.error || 'OCR extraction failed. Please fill fields manually.', { id: ocrToast });
            }
        } catch (err) {
            console.error('OCR call failed:', err);
            toast.error('OCR service unavailable. Please fill fields manually.', { id: ocrToast });
        } finally {
            setOcrLoading(false);
        }
    }, [resetOcrFields]);


    const fetchAllPms = useCallback(async () => {
        try {
            const res = await fetch('/api/pms', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setPms(data.pms || []);
            }
        } catch (error) {
            console.error("Failed to fetch PMs", error);
        }
    }, []);

    const fetchVendorProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/vendor/me', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setVendorProfile(data);
            }
        } catch (error) {
            console.error("Failed to fetch vendor profile", error);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchAllPms();
            if (getNormalizedRole(user) === ROLES.VENDOR) fetchVendorProfile();
        }
    }, [user, fetchAllPms, fetchVendorProfile]);

    const searchParams = useSearchParams();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
            return;
        }

        let timeoutId;
        const poll = async () => {
            await fetchSubmissions();
            // Schedule next poll only after current one finishes
            timeoutId = setTimeout(poll, 8000); // 8 seconds
        };

        poll();
        return () => clearTimeout(timeoutId);
    }, [user, authLoading, router, fetchSubmissions]);

    // Fetch unread re-check count (dynamic — disappears after vendor reads messages)
    const fetchUnreadRechecks = useCallback(async () => {
        try {
            const res = await fetch('/api/vendor/rechecks', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setUnreadRecheckCount(data.unreadCount || 0);
            }
        } catch (e) {
            console.error('Failed to fetch unread recheck count', e);
        }
    }, []);

    useEffect(() => {
        if (!user || authLoading) return;
        fetchUnreadRechecks();
        const interval = setInterval(fetchUnreadRechecks, 10000);
        return () => clearInterval(interval);
    }, [user, authLoading, fetchUnreadRechecks]);

    const stats = useMemo(() => {
        const total = allSubmissions.length;
        const paid = allSubmissions.filter((i) => i.status === "PAID").length;
        const pending = allSubmissions.filter((i) => !["PAID", "REJECTED"].includes(i.status)).length;
        const recheckCount = allSubmissions.filter((i) => i.status === INVOICE_STATUS.MORE_INFO_NEEDED || i.pmApproval?.status === "INFO_REQUESTED").length;
        const amount = allSubmissions.reduce((sum, i) => sum + (parseFloat(i.amount || i.totalAmount) || 0), 0);
        return { total, paid, pending, amount, recheckCount };
    }, [allSubmissions]);

    const handleUploadComplete = useCallback(() => {
        setLoading(true);
        fetchSubmissions();
        setTimeout(fetchSubmissions, 800);
    }, [fetchSubmissions]);

    const getStatusStyle = (status) => {
        switch (status) {
            case "PAID":
            case "VERIFIED":
            case "APPROVED":
                return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800";
            case "MATCH_DISCREPANCY":
                return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800";
            case "REJECTED":
                return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-800";
            case "DIGITIZING":
            case "RECEIVED":
                return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800 animate-pulse";
            case INVOICE_STATUS.MORE_INFO_NEEDED:
            case "INFO_REQUESTED":
                return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800";
            default:
                return "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800";
        }
    };

    const getStepStyle = (cfg) => {
        if (cfg.color === 'emerald') return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
        if (cfg.color === 'rose') return 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800';
        return 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800';
    };

    const getStatusDisplay = (approval) => {
        const status = approval?.status;
        if (status === 'APPROVED') {
            return { label: 'Approved', color: 'emerald', icon: 'CheckCircle2' };
        } else if (status === 'REJECTED') {
            return { label: 'Rejected', color: 'rose', icon: 'XCircle' };
        } else if (status === 'INFO_REQUESTED' || status === INVOICE_STATUS.MORE_INFO_NEEDED) {
            return { label: 'Re-check', color: 'amber', icon: 'AlertCircle' };
        }
        return { label: 'Waiting', color: 'orange', icon: 'Clock' }; // Default for PENDING or other states
    };

    const [viewerInvoiceId, setViewerInvoiceId] = useState(null);
    const [viewerDocUrl, setViewerDocUrl] = useState(null);
    const [viewerDocName, setViewerDocName] = useState(null);
    const [viewerLoading, setViewerLoading] = useState(true);
    const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
    const [spreadsheetData, setSpreadsheetData] = useState(null);

    const handleViewDocument = async (e, id) => {
        e.stopPropagation();
        setViewerDocUrl(null);
        setViewerDocName(null);
        setViewerInvoiceId(id);
        setViewerLoading(true);
        setSpreadsheetData(null);

        const inv = allSubmissions.find(i => i.id === id);
        if (inv) {
            const fileName = inv?.originalName?.toLowerCase() || "";
            const isSpreadsheet = fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv');

            if (isSpreadsheet) {
                try {
                    const res = await fetch(`/api/invoices/${id}/preview`, { cache: 'no-store' });
                    const data = await res.json();
                    if (data.data) {
                        setSpreadsheetData(data.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch spreadsheet preview:", err);
                }
            }
            setViewerLoading(false);
        } else {
            // Fetch if not in memory (though unlikely for submissions)
            try {
                await fetch(`/api/invoices/${id}`);
            } catch (err) {
                console.error("Failed to load invoice data", err);
            } finally {
                setViewerLoading(false);
            }
        }
    };

    const handleViewAdditionalDoc = (e, doc) => {
        e.stopPropagation();
        setViewerInvoiceId(null);
        setSpreadsheetData(null);
        setViewerDocUrl(`/api/documents/${doc.documentId}/file`);
        setViewerDocName(doc.fileName);
        setViewerLoading(false);
    };

    // Deep-linking: auto-open invoice viewer from query param
    useEffect(() => {
        const invoiceId = searchParams.get('invoiceId');
        if (invoiceId && allSubmissions.length > 0) {
            // Trigger the view document handler
            handleViewDocument({ stopPropagation: () => { } }, invoiceId);
        }
    }, [searchParams, allSubmissions]); // Removed handleViewDocument from deps to avoid unnecessary triggers

    const handleDownloadCSV = () => {
        if (allSubmissions.length === 0) {
            alert("No submissions to export.");
            return;
        }
        const headers = ["Invoice ID", "Original Name", "Date", "Amount", "Status"];
        const csvContent = [
            headers.join(","),
            ...allSubmissions.map((inv) =>
                [
                    inv.id,
                    `"${inv.originalName || "Invoice"}"`,
                    (() => {
                        const d = inv.date ? new Date(inv.date) : new Date(inv.receivedAt);
                        return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
                    })(),
                    inv.amount || inv.totalAmount || 0,
                    inv.status,
                ].join(",")
            ),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `vendor_export_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    return (
        <div className="space-y-10 max-w-7xl mx-auto h-full pb-10 px-4 sm:px-6 lg:px-0">
            <PageHeader
                title="Dashboard"
                subtitle="Manage billing, track payments, and resolve discrepancies."
                icon="Package"
                accent="teal"
                roleLabel={vendorProfile?.vendorCode ? `Vendor · ${vendorProfile.vendorCode}` : "Vendor"}
                actions={
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                        {getNormalizedRole(user) === ROLES.VENDOR && (
                            <button
                                onClick={() => setIsSubmissionModalOpen(true)}
                                className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-6 bg-teal-600 hover:bg-teal-700 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-lg shadow-teal-500/20 active:scale-95 transition-all whitespace-nowrap order-1 sm:order-0"
                            >
                                <Icon name="Plus" size={16} /> <span className="hidden xs:inline">New Submission</span><span className="xs:hidden">New</span>
                            </button>
                        )}

                        <div className="hidden sm:block h-10 w-px bg-slate-200 mx-1" />

                        <div className="flex items-center gap-2 order-2 sm:order-0">
                            <button
                                type="button"
                                onClick={() => { setLoading(true); fetchSubmissions(); }}
                                className="w-10 h-10 sm:w-11 sm:h-11 bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center"
                                title="Refresh"
                            >
                                <Icon name="RefreshCw" size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadCSV}
                                className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center"
                                title="Export CSV"
                            >
                                <Icon name="Download" size={18} />
                            </button>
                        </div>
                    </div>
                }
            />

            {/* Dashboard Stats - Top Row full-width */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: "Total Invoices", value: stats.total, icon: "FileText", color: "teal", sub: "Lifetime Submissions" },
                    { label: "Paid & Cleared", value: stats.paid, icon: "CheckCircle", color: "emerald", sub: "Successfully Processed" },
                    { label: "Processing", value: stats.pending, icon: "Clock", color: "amber", sub: "Awaiting Verification" },
                    { label: "Total Volume", value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.amount), icon: "DollarSign", color: "blue", sub: "Cumulative Billing", isPrice: true }
                ].map((stat, i) => (
                    <div key={i} className="bg-white/80 dark:bg-slate-800/80 p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-3 sm:mb-4">
                            <div className={clsx(
                                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm",
                                stat.color === 'teal' ? 'bg-teal-50 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400' :
                                    stat.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' :
                                        stat.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            )}>
                                <Icon name={stat.icon} size={22} />
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight">{stat.label}</span>
                        </div>
                        <p className={clsx("font-black text-slate-800 dark:text-slate-100 tracking-tight", stat.isPrice ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl")}>{stat.value}</p>
                        <div className={clsx(
                            "mt-4 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold w-fit px-3 py-1.5 rounded-full border shadow-sm",
                            stat.color === 'teal' ? 'bg-teal-50/50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-800' :
                                stat.color === 'emerald' ? 'bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' :
                                    stat.color === 'amber' ? 'bg-amber-50/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800' : 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                        )}>
                            {stat.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Attention Required Banner — only shows for UNREAD re-check messages */}
            <AnimatePresence>
                {unreadRecheckCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 p-6 rounded-4xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-amber-500/5"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 animate-bounce">
                                <Icon name="AlertTriangle" size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Attention Required: {unreadRecheckCount} Invoice{unreadRecheckCount > 1 ? 's' : ''}</h3>
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                                    <Icon name="MessageSquare" size={14} /> PM has requested re-verification of your documents
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/vendors/rechecks')}
                            className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 dark:hover:bg-white transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Icon name="AlertCircle" size={16} /> View Re-checks
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col gap-10">
                <div className="space-y-10">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-slate-200/40 dark:shadow-slate-800/40 border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-6 sm:p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-end justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl gap-4">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shadow-inner">
                                        <Icon name="History" size={22} />
                                    </div>
                                    Submission History
                                </h2>
                                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-2 sm:mt-3 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="hidden xs:block w-8 h-px bg-slate-200 dark:bg-slate-800" />
                                    Monitoring {allSubmissions.length} Ledger Records
                                </p>
                            </div>
                            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Live Transmission Active</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {/* Desktop Table View */}
                            <table className="hidden md:table w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                                        <th className="px-10 py-6">Invoice Reference</th>
                                        <th className="px-6 py-6">Approval Status</th>
                                        <th className="px-6 py-6">Financial Value</th>
                                        <th className="px-10 py-6 text-right">Vault Access</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {allSubmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-10 py-32 text-center">
                                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                                    <Icon name="Inbox" size={48} className="text-slate-200 dark:text-slate-700" />
                                                </div>
                                                <p className="text-xl font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Digital Vault Empty</p>
                                                <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-3">Ready for your first submission</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        allSubmissions.slice(0, 30).map((inv, idx) => {
                                            // Approval logic: Vendor -> PM -> Finance (CORRECT ORDER)
                                            const financeStatus = inv.financeApproval?.status;
                                            const pmStatus = inv.pmApproval?.status;

                                            let pmDisplay = { label: 'Waiting', color: 'orange', icon: 'Clock' };
                                            let financeDisplay = { label: 'Waiting', color: 'orange', icon: 'Clock' };

                                            // PM Step Logic (FIRST approval - comes before Finance)
                                            if (pmStatus === 'APPROVED') {
                                                pmDisplay = { label: 'Approved', color: 'emerald', icon: 'CheckCircle2' };
                                            } else if (pmStatus === 'REJECTED') {
                                                pmDisplay = { label: 'Rejected', color: 'rose', icon: 'XCircle' };
                                            } else if (pmStatus === 'INFO_REQUESTED' || inv.status === INVOICE_STATUS.MORE_INFO_NEEDED) {
                                                pmDisplay = { label: 'Re-check', color: 'amber', icon: 'AlertCircle' };
                                            }

                                            // Finance Step Logic (SECOND approval - only after PM approves)
                                            if (financeStatus === 'APPROVED') {
                                                financeDisplay = { label: 'Approved', color: 'emerald', icon: 'CheckCircle2' };
                                            } else if (financeStatus === 'REJECTED') {
                                                financeDisplay = { label: 'Rejected', color: 'rose', icon: 'XCircle' };
                                            }


                                            return (
                                                <motion.tr
                                                    key={inv.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    whileInView={{ opacity: 1, x: 0 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                                                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-300 cursor-pointer"
                                                    onClick={(e) => handleViewDocument(e, inv.id)}
                                                >
                                                    <td className="px-8 py-7 sm:px-10">
                                                        <div className="flex items-center gap-5 sm:gap-6">
                                                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm border border-indigo-100 dark:border-indigo-800 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                                                                <Icon name="FileText" size={26} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-black text-slate-800 dark:text-slate-200 text-base sm:text-lg truncate max-w-[200px] lg:max-w-[300px]" title={inv.originalName}>
                                                                    {inv.originalName || "DOCUMENT_ID_" + inv.id.slice(-6)}
                                                                </p>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-mono font-black bg-indigo-50/50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md border border-indigo-100/50 dark:border-indigo-800/50">{inv.invoiceNumber || inv.id.slice(0, 8)}</span>
                                                                    <span className="text-slate-300 dark:text-slate-600 text-[10px] font-black opacity-30">//</span>
                                                                    <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                                                                        {(() => {
                                                                            const d = inv.date ? new Date(inv.date) : new Date(inv.receivedAt);
                                                                            return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-7">
                                                        {/* Lifecycle Progress Tracker - Shows 7-stage workflow in horizontal format */}
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
                                                    </td>
                                                    <td className="px-6 py-7">
                                                        <div className="space-y-1.5">
                                                            <p className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inv.amount || 0)}
                                                            </p>
                                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-60">Value In Ledger</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-7 sm:px-10 text-right">
                                                        <div className="flex items-center justify-end gap-2.5">
                                                            <button
                                                                onClick={(e) => handleViewDocument(e, inv.id)}
                                                                className="w-11 h-11 inline-flex items-center justify-center text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 hover:bg-teal-600 hover:text-white rounded-xl shadow-sm transition-all duration-300 hover:scale-110 active:scale-95 text-[9px] font-black uppercase tracking-wider"
                                                                title={`View Invoice: ${inv.originalName}`}
                                                            >
                                                                INV
                                                            </button>
                                                            {inv.additionalDocs?.map((doc) => {
                                                                const isRfp = doc.type === 'ANNEX' || doc.type === 'RFP_COMMERCIAL';
                                                                const isTimesheet = doc.type === 'TIMESHEET';
                                                                const label = isRfp ? 'RFP' : isTimesheet ? 'TMS' : 'COM';
                                                                const btnStyle = isRfp
                                                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white'
                                                                    : isTimesheet
                                                                        ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 hover:bg-teal-600 hover:text-white'
                                                                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 hover:bg-amber-600 hover:text-white';
                                                                return (
                                                                    <button
                                                                        key={doc.documentId}
                                                                        onClick={(e) => handleViewAdditionalDoc(e, doc)}
                                                                        className={`w-11 h-11 inline-flex items-center justify-center border rounded-xl shadow-sm transition-all duration-300 hover:scale-110 active:scale-95 text-[9px] font-black uppercase tracking-wider ${btnStyle}`}
                                                                        title={`View ${isRfp ? 'RFP Document' : isTimesheet ? 'Timesheet' : 'Commercial'}: ${doc.fileName}`}
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4 px-2">
                                {allSubmissions.map((inv, idx) => {
                                    const pmDisplay = getStatusDisplay(inv.pmApproval || { status: 'PENDING' });
                                    const financeDisplay = getStatusDisplay(inv.financeApproval || { status: 'PENDING' });

                                    return (
                                        <motion.div
                                            key={inv.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-4xl p-6 border border-slate-200/60 dark:border-slate-800/60 shadow-sm active:scale-95 transition-all"
                                            onClick={(e) => handleViewDocument(e, inv.id)}
                                        >
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-100 dark:border-indigo-800">
                                                        <Icon name="FileText" size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm truncate max-w-[150px]">{inv.originalName || "INV_" + inv.id.slice(-6)}</h4>
                                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">
                                                            {(() => {
                                                                const d = inv.date ? new Date(inv.date) : new Date(inv.receivedAt);
                                                                return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(inv.amount || 0)}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleViewDocument(e, inv.id)}
                                                    className="flex-1 h-12 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-teal-100 dark:border-teal-800 flex items-center justify-center gap-2"
                                                >
                                                    View Invoice
                                                </button>
                                                <div className="flex gap-2">
                                                    {inv.additionalDocs?.map((doc) => (
                                                        <button
                                                            key={doc.documentId}
                                                            onClick={(e) => handleViewAdditionalDoc(e, doc)}
                                                            className={clsx(
                                                                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[10px] border shadow-sm",
                                                                (doc.type === 'ANNEX' || doc.type === 'RFP_COMMERCIAL') ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
                                                                    : doc.type === 'TIMESHEET' ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-800'
                                                                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                                                            )}
                                                            title={`View ${(doc.type === 'ANNEX' || doc.type === 'RFP_COMMERCIAL') ? 'RFP' : doc.type === 'TIMESHEET' ? 'Timesheet' : 'Commercial'}`}
                                                        >
                                                            {(doc.type === 'ANNEX' || doc.type === 'RFP_COMMERCIAL') ? 'RFP' : doc.type === 'TIMESHEET' ? 'TMS' : 'COM'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Lifecycle Progress Tracker - Shows 7-stage workflow in horizontal format */}
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

                                            <div className="mt-4 flex items-center justify-between gap-4">
                                                <span className={clsx(
                                                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border shadow-sm inline-flex items-center gap-2",
                                                    getStatusStyle(inv.status)
                                                )}>
                                                    <div className={clsx("w-1.5 h-1.5 rounded-full", inv.status === "DIGITIZING" || inv.status === "RECEIVED" ? "bg-amber-500 animate-pulse" : "bg-current")} />
                                                    {inv.status.replace("_", " ")}
                                                </span>
                                                <div className="text-right">
                                                    <p className="text-base font-black text-slate-800 dark:text-slate-200">
                                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inv.amount || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    <ActiveRates rateCards={rateCards} loading={loading} />

                    {/* Quick Guide card if needed */}
                    <div className="bg-slate-900 dark:bg-slate-950 rounded-4xl p-8 text-white relative overflow-hidden shadow-xl border border-white/5 dark:border-white/10">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <Icon name="LifeBuoy" size={100} />
                        </div>
                        <h3 className="text-xl font-black mb-4">Submission Guide</h3>
                        <ul className="space-y-3 text-sm text-slate-400 font-medium">
                            <li className="flex gap-3"><Icon name="CheckCircle" size={16} className="text-teal-500 shrink-0" /> Ensure PDF or Excel format</li>
                            <li className="flex gap-3"><Icon name="CheckCircle" size={16} className="text-teal-500 shrink-0" /> Upload RFP Commercial</li>
                            <li className="flex gap-3"><Icon name="CheckCircle" size={16} className="text-teal-500 shrink-0" /> Verify Basic Amount</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Refined Submission Modal */}
            <AnimatePresence>
                {isSubmissionModalOpen && (
                    <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setIsSubmissionModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl sm:rounded-4xl shadow-2xl overflow-hidden z-151 flex flex-col md:flex-row max-h-[95vh] sm:max-h-[90vh] border border-white dark:border-slate-800 mx-auto"
                        >
                            <div className="hidden lg:flex lg:w-[35%] bg-teal-600 p-10 flex-col justify-between text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12">
                                    <Icon name="ShieldCheck" size={200} />
                                </div>
                                <div className="relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-8 shadow-inner">
                                        <Icon name="UploadCloud" size={28} />
                                    </div>
                                    <h2 className="text-3xl font-black tracking-tight leading-tight">Smart Ingestion Vault</h2>
                                    <p className="text-teal-50/70 text-sm mt-4 font-medium leading-relaxed">
                                        Submit your documents directly to our AI-powered digitization engine.
                                    </p>
                                </div>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-xs">1</div>
                                        <p className="text-xs font-bold leading-relaxed opacity-90">Instant OCR Digitization</p>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-xs">2</div>
                                        <p className="text-xs font-bold leading-relaxed opacity-90">PM Approval Review</p>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-xs">3</div>
                                        <p className="text-xs font-bold leading-relaxed opacity-90">Finance Final Approval</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-6 sm:p-12 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                                <div className="flex items-center justify-between mb-8 sm:mb-10">
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Invoice Details</h3>
                                        <div className="h-1 w-12 bg-teal-600 mt-2 rounded-full" />
                                    </div>
                                    <button
                                        onClick={() => setIsSubmissionModalOpen(false)}
                                        className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
                                    >
                                        <Icon name="X" size={20} />
                                    </button>
                                </div>

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = e.target;
                                    const formData = new FormData(form);
                                    const file = formData.get('file');
                                    if (!file || file.size === 0) { toast.error("Please upload an invoice file."); return; }

                                    setLoading(true);
                                    const toastId = toast.loading("Uploading invoice...");
                                    try {
                                        const metadata = {
                                            assignedPM: selectedPM,
                                            assignedFinanceUser: null,
                                            invoiceNumber: formData.get('invoiceNumber'),
                                            date: formData.get('date'),
                                            invoiceDate: formData.get('invoiceDate'),
                                            amount: formData.get('amount'),
                                            basicAmount: formData.get('basicAmount'),
                                            taxType: formData.get('taxType'),
                                            hsnCode: formData.get('hsnCode'),
                                            disclaimerAccepted: formData.get('disclaimerAccepted'),
                                        };
                                        const additionalFiles = {
                                            rfpFile: formData.get('rfpFile'),
                                            timesheetFile: formData.get('timesheetFile'),
                                        };
                                        await import("@/lib/api").then(mod => mod.ingestInvoice(file, metadata, additionalFiles));
                                        toast.success("Invoice submitted successfully!", { id: toastId });
                                        setIsSubmissionModalOpen(false);
                                        setSelectedFile(null);
                                        setRfpFileName('');
                                        setCommercialFileName('');
                                        resetOcrFields();
                                        handleUploadComplete();
                                    } catch {
                                        toast.error("Failed to submit invoice. Please try again.", { id: toastId });
                                    } finally { setLoading(false); }
                                }} className="space-y-6">
                                    <div className="space-y-5">
                                        {/* Invoice File (PDF) - Moved to top */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Invoice (PDF) <span className="text-rose-500">*</span></label>
                                            <div className="relative group/modalfile border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-all p-8 flex flex-col items-center justify-center gap-3">
                                                <input
                                                    type="file"
                                                    name="file"
                                                    accept=".pdf"
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                    required={!selectedFile}
                                                    onChange={handleInvoiceFileChange}
                                                />
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm",
                                                    selectedFile ? "bg-teal-500 text-white" : ocrLoading ? "bg-amber-500 text-white animate-pulse" : "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 group-hover/modalfile:text-teal-600 dark:group-hover/modalfile:text-teal-400 group-hover/modalfile:bg-white dark:group-hover/modalfile:bg-slate-800"
                                                )}>
                                                    <Icon name={ocrLoading ? "Loader" : selectedFile ? "FileCheck" : "FileUp"} size={24} />
                                                </div>
                                                <div className="text-center">
                                                    {selectedFile ? (
                                                        <>
                                                            <p className="text-[11px] font-black text-teal-600 uppercase tracking-widest">{selectedFile.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {ocrLoading ? 'OCR in progress...' : 'Click to change'}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Select Invoice PDF</p>
                                                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tight">PDF Only (Max 10MB) • Fields will auto-fill via OCR</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Assign to Project Manager <span className="text-rose-500">*</span></label>
                                            <select
                                                className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
                                                value={selectedPM}
                                                onChange={(e) => setSelectedPM(e.target.value)}
                                                required
                                            >
                                                <option value="">Select Project Manager</option>
                                                {pms.map(pm => (
                                                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* OCR Loading Overlay */}
                                        {ocrLoading && (
                                            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-20 rounded-3xl flex flex-col items-center justify-center gap-3">
                                                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                                <p className="text-[11px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">Extracting Invoice Data...</p>
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Powered by Mindee OCR</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">Invoice No. <span className="text-rose-500">*</span></label>
                                                <input type="text" name="invoiceNumber" value={ocrInvoiceNumber} onChange={(e) => setOcrInvoiceNumber(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder={ocrLoading ? 'Extracting...' : 'e.g. #7721'} required />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">Invoice Date <span className="text-rose-500">*</span></label>
                                                <input type="date" name="invoiceDate" value={ocrInvoiceDate} onChange={(e) => setOcrInvoiceDate(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-color-slate-900/50" required />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">Basic Amount <span className="text-rose-500">*</span></label>
                                                <input type="number" name="basicAmount" step="0.01" value={ocrBasicAmount} onChange={(e) => setOcrBasicAmount(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-mono placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder={ocrLoading ? 'Extracting...' : '0.00'} required />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">Total Amount (₹) <span className="text-rose-500">*</span></label>
                                                <input type="number" name="amount" step="0.01" value={ocrTotalAmount} onChange={(e) => setOcrTotalAmount(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-mono placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder={ocrLoading ? 'Extracting...' : '0.00'} required />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">Taxes <span className="text-rose-500">*</span></label>
                                                <select
                                                    name="taxType"
                                                    value={ocrTaxType}
                                                    onChange={(e) => setOcrTaxType(e.target.value)}
                                                    className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
                                                    required
                                                >
                                                    <option value="">Select Tax Type</option>
                                                    <option value="CGST_SGST">CGST + SGST</option>
                                                    <option value="IGST">IGST</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1 min-h-[16px] flex items-end">HSN Code <span className="text-rose-500">*</span></label>
                                                <input type="text" name="hsnCode" value={ocrHsnCode} onChange={(e) => setOcrHsnCode(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder={ocrLoading ? 'Extracting...' : 'e.g. 998314'} required />
                                            </div>
                                        </div>

                                        {/* Submission date auto-set on backend */}
                                        <input type="hidden" name="date" value={new Date().toISOString().split('T')[0]} />



                                        {/* Additional Documents Section */}
                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px flex-1 bg-slate-200" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Additional Documents</span>
                                                <div className="h-px flex-1 bg-slate-200" />
                                            </div>

                                            {/* RFP Document */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RFP Document</label>
                                                <div className={clsx(
                                                    "relative border-2 rounded-2xl transition-all p-4 flex items-center gap-4",
                                                    rfpFileName ? "border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500"
                                                )}>
                                                    <input
                                                        type="file"
                                                        name="rfpFile"
                                                        accept=".pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => setRfpFileName(e.target.files?.[0]?.name || '')}
                                                    />
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                        rfpFileName ? "bg-emerald-500 text-white" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400"
                                                    )}>
                                                        <Icon name={rfpFileName ? "CheckCircle" : "FileText"} size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        {rfpFileName ? (
                                                            <>
                                                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 truncate">{rfpFileName}</p>
                                                                <p className="text-[9px] text-emerald-500 dark:text-emerald-500 font-bold uppercase tracking-tight">Uploaded ✓</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Upload RFP</p>
                                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">PDF, Word, Excel</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Commercial / Timesheet */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Commercial / Timesheet</label>
                                                <div className={clsx(
                                                    "relative border-2 rounded-2xl transition-all p-4 flex items-center gap-4",
                                                    commercialFileName ? "border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-dashed border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500"
                                                )}>
                                                    <input
                                                        type="file"
                                                        name="timesheetFile"
                                                        accept=".pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => setCommercialFileName(e.target.files?.[0]?.name || '')}
                                                    />
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                        commercialFileName ? "bg-emerald-500 text-white" : "bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400"
                                                    )}>
                                                        <Icon name={commercialFileName ? "CheckCircle" : "Clock"} size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        {commercialFileName ? (
                                                            <>
                                                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 truncate">{commercialFileName}</p>
                                                                <p className="text-[9px] text-emerald-500 dark:text-emerald-500 font-bold uppercase tracking-tight">Uploaded ✓</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Upload Commercial / Timesheet</p>
                                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">PDF, Excel</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Declaration & Confirmation Section */}
                                    <div className="space-y-3 pt-4">
                                        <div className="text-amber-600 text-[11px] font-bold uppercase leading-relaxed">
                                            DECLARATION & CONFIRMATION
                                        </div>
                                        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl p-6 flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                name="disclaimerAccepted"
                                                value="true"
                                                required
                                                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                                                className="accent-teal-600"
                                            />
                                            <div className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">
                                                Disclaimer- I have verified all the information as per agreed terms with Maruti Suzuki India Limited. The Invoice, RFP Proposal/Timesheet is strictly as per agreement.
                                            </div>
                                            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                                <Icon name={disclaimerChecked ? "CheckCircle" : "Warning"} size={18} className={disclaimerChecked ? "text-emerald-500" : "text-amber-500"} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsSubmissionModalOpen(false)}
                                            className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-2 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:grayscale"
                                            disabled={loading || !disclaimerChecked}
                                        >
                                            {loading ? <span className="loading loading-spinner loading-xs"></span> : <Icon name="Send" size={16} />}
                                            Submit Invoice
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Document viewer modal (refined for better handling) */}
            <AnimatePresence>
                {(viewerInvoiceId || viewerDocUrl) && (
                    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-210"
                            onClick={() => { setViewerInvoiceId(null); setViewerDocUrl(null); setViewerDocName(null); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-y-auto z-220 flex flex-col max-h-[90vh] border border-white dark:border-slate-800"
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 gap-4 relative">
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-200 dark:shadow-teal-900/40 shrink-0">
                                        <Icon name="FileText" size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm truncate max-w-[200px] sm:max-w-md">
                                            {viewerDocName || allSubmissions.find((i) => i.id === viewerInvoiceId)?.originalName || `Invoice ${viewerInvoiceId}`}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Secure Document Access</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start z-230">
                                    <a
                                        href={viewerDocUrl || `/api/invoices/${viewerInvoiceId}/file`}
                                        download
                                        className="h-9 sm:h-10 px-3 sm:px-4 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                                    >
                                        <Icon name="Download" size={14} /> <span className="hidden xs:inline">Download</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => { setViewerInvoiceId(null); setViewerDocUrl(null); setViewerDocName(null); }}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors bg-slate-100 dark:bg-slate-800 z-240"
                                        style={{ position: 'relative', zIndex: 240 }}
                                    >
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative min-h-[60vh] max-h-[80vh] overflow-y-auto">
                                {viewerLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
                                        <span className="loading loading-spinner loading-lg text-teal-600 mb-4" />
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Retreiving Vault Record...</p>
                                    </div>
                                )}
                                {(() => {
                                    if (viewerDocUrl) {
                                        return (
                                            <DocumentViewer
                                                invoiceId={null}
                                                fileName={viewerDocName}
                                                customFileUrl={viewerDocUrl}
                                                onLoadingComplete={() => setViewerLoading(false)}
                                            />
                                        );
                                    }
                                    const inv = allSubmissions.find(i => i.id === viewerInvoiceId);
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
