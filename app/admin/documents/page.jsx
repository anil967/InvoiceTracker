"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/Layout/PageHeader";

export default function AdminDocumentsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");
    const [viewerDocumentId, setViewerDocumentId] = useState(null);
    const [viewerLoading, setViewerLoading] = useState(true);

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && (!user || role !== ROLES.ADMIN)) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/api/admin/documents');
            setDocuments(res.data.documents || []);
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDocuments = documents.filter(doc => {
        // Type filter
        if (filter !== "ALL" && doc.type !== filter) return false;
        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                doc.fileName?.toLowerCase().includes(term) ||
                doc.uploadedBy?.name?.toLowerCase().includes(term) ||
                doc.type?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const documentTypes = ["ALL", "INVOICE", "RINGI", "RFP_COMMERCIAL", "TIMESHEET", "RATE_CARD"];

    const getTypeColor = (type) => {
        const colors = {
            INVOICE: "bg-blue-100 text-blue-700",
            RINGI: "bg-purple-100 text-purple-700",
            RFP_COMMERCIAL: "bg-teal-100 text-teal-700",
            TIMESHEET: "bg-amber-100 text-amber-700",
            RATE_CARD: "bg-rose-100 text-rose-700",
        };
        return colors[type] || "bg-slate-100 text-slate-700";
    };

    const getStatusColor = (status) => {
        if (!status) return "bg-slate-100 text-slate-600";
        const s = status.toUpperCase();
        if (s.includes("APPROVED") || s.includes("VALIDATED") || s.includes("VERIFIED")) {
            return "bg-emerald-100 text-emerald-700";
        }
        if (s.includes("REJECTED") || s.includes("DISCREPANCY")) {
            return "bg-rose-100 text-rose-700";
        }
        if (s.includes("PENDING")) {
            return "bg-amber-100 text-amber-700";
        }
        return "bg-slate-100 text-slate-600";
    };

    const formatDate = (date) => {
        if (!date) return "—";
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const handleViewDocument = (e, id) => {
        e.stopPropagation();
        setViewerDocumentId(id);
        setViewerLoading(true);
    };

    if (authLoading || !user || getNormalizedRole(user) !== ROLES.ADMIN) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="pb-10">
            <PageHeader
                title="Document Repository"
                subtitle="View all uploaded documents"
                icon="FolderOpen"
                accent="purple"
                roleLabel="Administrator"
            />

            <Card className="p-0 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none w-64"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                            {documentTypes.map(type => (
                                <option key={type} value={type}>
                                    {type === "ALL" ? "All Types" : type.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchDocuments}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition-colors"
                        >
                            <Icon name="RefreshCw" size={14} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">File Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded By</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <span className="loading loading-spinner loading-md text-primary"></span>
                                    </td>
                                </tr>
                            ) : filteredDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        <Icon name="FileX" size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>No documents found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredDocuments.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                                                    <Icon name="FileText" size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-gray-900 truncate max-w-xs">{doc.fileName}</p>
                                                    <p className="text-xs text-slate-400">{doc.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getTypeColor(doc.type)}`}>
                                                {doc.type?.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-sm text-gray-800">{doc.uploadedBy?.name || "Unknown"}</p>
                                                <p className="text-xs text-slate-400">{doc.uploadedBy?.role || "—"}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(doc.status)}`}>
                                                {doc.status?.replace(/_/g, " ") || "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {formatDate(doc.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {doc.fileUrl ? (
                                                <button
                                                    onClick={(e) => handleViewDocument(e, doc.id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                                                >
                                                    <Icon name="Eye" size={12} />
                                                    View
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">No file</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {filteredDocuments.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-sm text-slate-500">
                        Showing {filteredDocuments.length} of {documents.length} documents
                    </div>
                )}
            </Card>

            {/* Document viewer modal - matching vendor page implementation */}
            <AnimatePresence>
                {viewerDocumentId && (
                    <div className="fixed inset-0 z- flex items-center justify-center p-4">
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
                            className="relative bg-white w-full max-w-5xl rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden z- flex flex-col max-h-[90vh] border border-white"
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 bg-slate-50/50 gap-4">
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200 shrink-0">
                                        <Icon name="FileText" size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-slate-800 text-sm truncate max-w-[200px] sm:max-w-md">
                                            {documents.find((doc) => doc.id === viewerDocumentId)?.fileName || `Document ${viewerDocumentId}`}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Secure Document Access</p>
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
                                        <span className="loading loading-spinner loading-lg text-purple-600 mb-4" />
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
                                                    className="inline-flex items-center gap-3 h-14 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-purple-200 transition-all active:scale-95"
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
    );
}
