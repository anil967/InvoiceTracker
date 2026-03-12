'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Card from '@/components/ui/Card';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { getNormalizedRole, ROLES } from '@/constants/roles';

/**
 * Format month from YYYY-MM or YYYY-MM to display format (e.g., "Feb 2026")
 */
const formatBillingMonth = (monthValue) => {
    if (!monthValue) return monthValue;
    const [year, month] = monthValue.split('-');
    if (!year || !month) return monthValue;

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month)]} ${year}`;
};

const DOCUMENT_TYPES = [
    { value: 'RINGI', label: 'Ringi', description: 'PDF, Word, or Excel', color: 'purple' },
    { value: 'ANNEX', label: 'Annex', description: 'PDF, Word, or Excel', color: 'blue' },
    { value: 'TIMESHEET', label: 'Timesheet', description: 'Excel, PDF, or Word', color: 'green' },
    { value: 'RATE_CARD', label: 'Rate Card', description: 'Excel or PDF', color: 'orange' }
];

export default function FinanceDocumentsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const role = getNormalizedRole(user);
    const canUploadDocuments = role !== ROLES.ADMIN;

    const [documents, setDocuments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewerDocumentId, setViewerDocumentId] = useState(null);
    const [viewerLoading, setViewerLoading] = useState(true);
    const fileInputRef = useRef(null);

    const [uploadData, setUploadData] = useState({
        file: null,
        type: 'RINGI',
        billingMonth: '',
        ringiNumber: '',
        description: ''
    });
    const [validationResult, setValidationResult] = useState(null);

    // Role-based access control
    useEffect(() => {
        if (!authLoading && (!user || role !== ROLES.FINANCE_USER)) {
            router.push("/dashboard");
        }
    }, [user, authLoading, role, router]);

    useEffect(() => {
        fetchDocuments();
        fetchProjects();
    }, [filterType, filterProject, searchQuery]);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('type', filterType);

            const res = await fetch(`/api/finance/documents?${params}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setDocuments(data.documents || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/finance/projects', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) setProjects(data.projects || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadData({ ...uploadData, file });
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.file || !uploadData.type) return;

        if (!uploadData.file || !uploadData.type) return;

        try {
            // Start upload process
            setUploadingAttachment(true);
            setUploading(true);
            setError(null);
            setValidationResult(null);

            // Validate file size (max 10MB)
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
            if (uploadData.file.size > MAX_FILE_SIZE) {
                throw new Error(`File size exceeds maximum limit of 10MB. Please upload a smaller file.`);
            }

            // Validate file extension
            const allowedExtensions = ['pdf', 'xlsx', 'xls', 'doc', 'docx'];
            const fileExtension = uploadData.file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                throw new Error(`Invalid file type. Allowed formats: PDF, Excel (.xlsx, .xls), or Word (.doc, .docx).`);
            }

            const formData = new FormData();
            formData.append('file', uploadData.file);
            formData.append('type', uploadData.type);
            if (uploadData.billingMonth) formData.append('billingMonth', uploadData.billingMonth);
            if (uploadData.ringiNumber) formData.append('ringiNumber', uploadData.ringiNumber);
            if (uploadData.description) formData.append('description', uploadData.description);

            const res = await fetch('/api/finance/documents', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (!res.ok) {
                // Handle specific error messages from backend
                if (data.details) {
                    throw new Error(data.details);
                } else if (data.error) {
                    throw new Error(data.error);
                } else {
                    throw new Error('Failed to upload document. Please try again or contact support.');
                }
            }

            // Show validation result
            if (data.validation) {
                setValidationResult(data.validation);
            }

            setSuccess(data.validation?.isValid
                ? `Document "${uploadData.file.name}" uploaded and validated successfully!`
                : `Document "${uploadData.file.name}" uploaded - pending review`);

            // Close modal and reset form
            setShowUploadModal(false);
            setUploadData({
                file: null,
                type: 'RINGI',
                billingMonth: '',
                ringiNumber: '',
                description: ''
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchDocuments();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload document. Please try again.');
        } finally {
            setUploadingAttachment(false);
            setUploading(false);
        }
    };

    const getTypeClasses = (type) => {
        switch (type) {
            case 'RINGI': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'ANNEX': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'TIMESHEET': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'RATE_CARD': return 'bg-orange-50 text-orange-600 border-orange-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getStatusClasses = (status) => {
        switch (status) {
            case 'VALIDATED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-amber-50 text-amber-600 border-amber-100';
        }
    };

    const handleViewDocument = (e, id) => {
        e.stopPropagation();
        setViewerDocumentId(id);
        setViewerLoading(true);
    };

    const categories = [
        { id: 'RINGI', label: 'Ringi', icon: 'FileText' },
        { id: 'ANNEX', label: 'Annex', icon: 'File' },
        { id: 'TIMESHEET', label: 'Timesheet', icon: 'Calendar' },
        { id: 'RATE_CARD', label: 'Rate Card', icon: 'CreditCard' },
    ];

    if (authLoading || !user || role !== ROLES.FINANCE_USER) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-8 py-6 sm:py-8 min-h-screen">
            <PageHeader
                title="Document Repository"
                subtitle="Central repository for finance documents"
                icon="Folder"
                accent="indigo"
                roleLabel="Finance User"
                actions={canUploadDocuments ? (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center justify-center gap-2 h-10 px-4 sm:px-6 bg-linear-to-br from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all whitespace-nowrap"
                    >
                        <Icon name="Plus" size={16} /> <span className="hidden xs:inline">Upload New</span><span className="xs:hidden">Upload</span>
                    </button>
                ) : undefined}
            />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Filters */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-3 sm:p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="relative">
                            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search documents..."
                                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white/50 font-medium"
                        >
                            <option value="">All Types</option>
                            {DOCUMENT_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Messages */}
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                            <span className="font-medium">{error}</span>
                            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg">✕</button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                            <span className="font-medium">{success}</span>
                            <button onClick={() => setSuccess(null)} className="p-1 hover:bg-emerald-100 rounded-lg">✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Documents Grid */}
                {loading ? (
                    <div className="text-center py-20">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                        <p className="mt-4 text-slate-500 font-medium">Loading documents...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents
                            .filter(doc =>
                                !searchQuery ||
                                doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                doc.metadata?.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                doc.type.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map((doc, idx) => (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card className="h-full hover:shadow-md transition-all border-slate-200/60 p-6">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                    <Icon name="File" className="text-slate-400" size={24} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-bold text-slate-800 truncate" title={doc.fileName}>
                                                        {doc.fileName}
                                                    </h3>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                                                        {(doc.fileSize / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shrink-0 ${getTypeClasses(doc.type)}`}>
                                                {doc.type.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            {doc.metadata?.billingMonth && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Month</span>
                                                    <span className="text-xs font-bold text-slate-700">{formatBillingMonth(doc.metadata.billingMonth)}</span>
                                                </div>
                                            )}
                                            {doc.metadata?.ringiNumber && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ringi #</span>
                                                    <span className="text-xs font-bold text-slate-700">{doc.metadata.ringiNumber}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getStatusClasses(doc.status)}`}>
                                                {doc.status}
                                            </span>
                                            <button
                                                onClick={(e) => handleViewDocument(e, doc.id)}
                                                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-black text-[10px] uppercase tracking-widest transition-colors bg-transparent border-0 p-0 cursor-pointer"
                                            >
                                                View <Icon name="Eye" size={12} />
                                            </button>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                    </div>
                )}

                {!loading && documents.length === 0 && (
                    <Card className="text-center py-20">
                        <div className="max-w-xs mx-auto">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Icon name="Inbox" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">No documents found</h3>
                            <p className="text-slate-500 mt-1">Start by uploading your first finance document.</p>
                        </div>
                    </Card>
                )}

                {/* Upload Modal */}
                <AnimatePresence>
                    {showUploadModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-100 p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-3xl p-5 sm:p-8 w-full max-w-xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Upload Document</h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Finance Document Repository</p>
                                    </div>
                                    <button
                                        onClick={() => setShowUploadModal(false)}
                                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                                    >
                                        <Icon name="X" size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleUpload} className="space-y-6">
                                    {error && (
                                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex justify-between items-center">
                                            <span>{error}</span>
                                            <button type="button" onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg">✕</button>
                                        </div>
                                    )}

                                    {/* Document Type Selection */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">1. Select Document Type</label>
                                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 gap-3">
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setUploadData({ ...uploadData, type: cat.id })}
                                                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${uploadData.type === cat.id
                                                        ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-500/10"
                                                        : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <div className={`p-2 rounded-xl transition-colors ${uploadData.type === cat.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100"}`}>
                                                        <Icon name={cat.icon} size={20} />
                                                    </div>
                                                    <span className={`text-[10px] sm:text-xs font-bold ${uploadData.type === cat.id ? "text-indigo-900" : "text-slate-600"}`}>{cat.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* File Input Area */}
                                    <div className="relative">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">2. Attachment</label>

                                        {/* Upload loading state */}
                                        {uploadingAttachment ? (
                                            <div className="relative border-2 border-dashed border-purple-400 bg-purple-50/50 rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 animate-pulse">
                                                    <Icon name="Upload" size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-purple-700">Uploading file...</p>
                                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mt-1">Please wait</p>
                                                </div>
                                            </div>
                                        ) : uploadData.file ? (
                                            /* File selected state */
                                            <div className="relative border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl p-4 transition-all">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                        <Icon name="FileText" size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-700 truncate" title={uploadData.file.name}>
                                                            {uploadData.file.name}
                                                        </p>
                                                        <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                                                            {(uploadData.file.size / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setUploadData({ ...uploadData, file: null });
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                        }}
                                                        className="p-2 hover:bg-rose-100 rounded-xl text-rose-500 transition-colors shrink-0"
                                                        title="Remove file"
                                                    >
                                                        <Icon name="Trash2" size={16} />
                                                    </button>
                                                </div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                                                    className="hidden"
                                                />
                                            </div>
                                        ) : (
                                            /* No file selected state */
                                            <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-8 transition-all hover:bg-slate-50 hover:border-purple-300 flex flex-col items-center justify-center gap-3 cursor-pointer">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                                    <Icon name="Upload" size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">Click or drop to upload</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">PDF, Excel, or Word (Max 10MB)</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Additional Details Fields */}
                                    <div className="grid grid-cols-1 gap-6">

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Billing cycle (Date)</label>
                                            <input
                                                type="text"
                                                placeholder="DD/MM/YY"
                                                value={uploadData.billingMonth}
                                                onChange={(e) => setUploadData({ ...uploadData, billingMonth: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Type-specific Fields */}
                                    {uploadData.type === 'RINGI' && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Ringi Control Number</label>
                                            <input
                                                type="text"
                                                value={uploadData.ringiNumber}
                                                onChange={(e) => setUploadData({ ...uploadData, ringiNumber: e.target.value })}
                                                placeholder="e.g. RINGI/2026/042"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold text-sm"
                                            />
                                        </motion.div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowUploadModal(false)}
                                            disabled={uploading}
                                            className="order-2 sm:order-1 flex-1 px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Cancel Action
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!uploadData.file || uploading}
                                            className="order-1 sm:order-2 flex-1 px-6 py-4 bg-linear-to-br from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {uploading ? (
                                                <><span className="loading loading-spinner loading-xs"></span> Finalizing...</>
                                            ) : (
                                                'Process Upload'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Document viewer modal - matching vendor page implementation */}
                <AnimatePresence>
                    {viewerDocumentId && (
                        <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                                onClick={() => setViewerDocumentId(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative bg-white w-full max-w-5xl rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden z-151 flex flex-col max-h-[90vh] border border-white"
                            >
                                <div className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-slate-50/50 gap-4">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
                                            <Icon name="FileText" size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-black text-slate-800 text-sm truncate max-w-[200px] sm:max-w-md">
                                                {documents.find((doc) => doc.id === viewerDocumentId)?.fileName || `Document ${viewerDocumentId}`}
                                            </h3>
                                            {documents.find((doc) => doc.id === viewerDocumentId)?.metadata?.billingMonth && (
                                                <p className="text-[11px] font-bold text-indigo-600 mt-0.5">
                                                    Billing Cycle: {formatBillingMonth(documents.find((doc) => doc.id === viewerDocumentId).metadata.billingMonth)}
                                                </p>
                                            )}
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Secure Document Access</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                                        <a
                                            href={documents.find((doc) => doc.id === viewerDocumentId)?.source === 'invoice'
                                                ? `/api/invoices/${viewerDocumentId}/file`
                                                : `/api/documents/${viewerDocumentId}/file`}
                                            download
                                            className="h-9 sm:h-10 px-3 sm:px-4 flex items-center gap-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                                        >
                                            <Icon name="Download" size={14} /> <span className="hidden xs:inline">Download</span>
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setViewerDocumentId(null)}
                                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors bg-slate-100"
                                        >
                                            <Icon name="X" size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 bg-slate-100 relative min-h-[60vh]">
                                    {viewerLoading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                                            <span className="loading loading-spinner loading-lg text-indigo-600 mb-4" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Retrieving Document...</p>
                                        </div>
                                    )}
                                    {(() => {
                                        const doc = documents.find(d => d.id === viewerDocumentId);
                                        const fileName = doc?.fileName?.toLowerCase() || "";
                                        const isOfficeDoc = fileName.endsWith('.doc') || fileName.endsWith('.docx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
                                        const docUrl = doc?.source === 'invoice' ? `/api/invoices/${viewerDocumentId}/file` : `/api/documents/${viewerDocumentId}/file`;

                                        if (isOfficeDoc) {
                                            return (
                                                <div className="flex flex-col items-center justify-center h-full p-20 text-center space-y-6">
                                                    <div className="w-24 h-24 rounded-[2.5rem] bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                                                        <Icon name="AlertCircle" size={48} />
                                                    </div>
                                                    <div className="max-w-md">
                                                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Preview Unavailable</h4>
                                                        <p className="text-sm font-medium text-slate-500 mt-2 leading-relaxed">
                                                            Office documents (.doc, .xls) cannot be rendered directly in the browser. Please download the file to view its contents.
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={docUrl}
                                                        download
                                                        className="inline-flex items-center gap-3 h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all active:scale-95"
                                                        onLoad={() => setViewerLoading(false)}
                                                    >
                                                        <Icon name="Download" size={20} /> Download for Viewing
                                                    </a>
                                                </div>
                                            );
                                        }

                                        return (
                                            <iframe
                                                src={docUrl}
                                                title="Document preview"
                                                className="w-full h-full min-h-[60vh] border-0"
                                                onLoad={() => setViewerLoading(false)}
                                            />
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}