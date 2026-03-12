"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { toast } from "sonner";
import Icon from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES, getNormalizedRole } from "@/constants/roles";

export default function AuditLogPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const role = getNormalizedRole(user);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterAction, setFilterAction] = useState("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [exporting, setExporting] = useState(false);
    const itemsPerPage = 20;

    useEffect(() => {
        if (!authLoading && (!user || role !== ROLES.ADMIN)) {
            router.push("/dashboard");
        }
    }, [user, authLoading, role, router]);

    useEffect(() => {
        if (role === ROLES.ADMIN) {
            fetchLogs();
        }
    }, [role]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get("/api/audit?limit=200");
            setLogs(res.data);
        } catch (error) {
            toast.error("Failed to fetch audit logs");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.invoice_id?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterAction === "ALL" || log.action === filterAction;

        return matchesSearch && matchesFilter;
    });

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };


    const actionColors = {
        UPDATE: "bg-blue-50 text-blue-700 border-blue-100",
        CREATE: "bg-green-50 text-green-700 border-green-100",
        DELETE: "bg-red-50 text-red-700 border-red-100",
        APPROVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
        REJECT: "bg-orange-50 text-orange-700 border-orange-100",
        LOGIN: "bg-purple-50 text-purple-700 border-purple-100"
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const escapeCSV = (value) => {
        if (value === null || value === undefined) {
            return "";
        }
        const stringValue = String(value);
        // If value contains comma, newline, or quote, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const getUserType = (username) => {
        if (!username || username === "System") return "System";
        // You can customize this logic based on your actual user type detection
        // For now, we'll derive from username pattern or additional props
        // This is a placeholder - adjust based on your actual user management system
        return "Admin"; // Default, you might want to get this from the log object
    };

    const handleExport = async () => {
        // Check if there are logs to export
        if (filteredLogs.length === 0) {
            toast.error("No audit logs available to export");
            return;
        }

        try {
            setExporting(true);

            // Generate CSV content
            const headers = ["Timestamp", "User Name", "User Type", "Action Category", "Action Type", "Details / Description"];

            const csvRows = [
                // Add header row
                headers.map(escapeCSV).join(","),
                // Add data rows
                ...filteredLogs.map(log => {
                    const timestamp = formatDate(log.timestamp);
                    const userName = log.username || "System";
                    const userType = log.user_type || getUserType(log.username);
                    const actionCategory = log.action || "N/A";
                    const actionType = log.action_type || log.action || "N/A";
                    const details = log.details || "N/A";

                    return [
                        escapeCSV(timestamp),
                        escapeCSV(userName),
                        escapeCSV(userType),
                        escapeCSV(actionCategory),
                        escapeCSV(actionType),
                        escapeCSV(details)
                    ].join(",");
                })
            ];

            const csvContent = csvRows.join("\n");

            // Create file with UTF-8 BOM for Excel compatibility
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

            // Generate filename with timestamp
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const filename = `audit_logs_${year}-${month}-${day}_${hour}-${minute}.csv`;

            // Create download link and trigger download
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            toast.success(`Exported ${filteredLogs.length} audit logs successfully`);
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export audit logs");
        } finally {
            setExporting(false);
        }
    };

    if (authLoading || !user || role !== ROLES.ADMIN) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 px-1">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight uppercase">
                        Audit Logs
                    </h1>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Complete system activity history</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={fetchLogs}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all active:scale-95"
                    >
                        <Icon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        <Icon name="Download" size={14} />
                        Export
                    </button>
                </div>
            </div>
            {/* Filter */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-3 sm:p-4 mb-6">
                <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="px-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white/50 font-medium"
                >
                    <option value="ALL">All Actions</option>
                    <option value="UPDATE">Updates</option>
                    <option value="CREATE">Creates</option>
                    <option value="APPROVE">Approvals</option>
                    <option value="REJECT">Rejections</option>
                </select>
            </div>


            {/* Logs Table */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading audit logs...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Icon name="FileText" size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">No audit logs found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Timestamp</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">User & Action</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 hidden lg:table-cell">Action Category</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedLogs.map((log, idx) => (
                                    <tr key={log._id || idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] sm:text-xs text-slate-500 font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-linear-to-r from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0">
                                                    {log.username?.charAt(0) || "S"}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">{log.username || "System"}</p>
                                                    <p className="lg:hidden text-[9px] font-black uppercase tracking-tighter text-indigo-600">{log.action}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${actionColors[log.action] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[11px] text-gray-600 max-w-xs truncate hidden sm:table-cell">
                                            {log.details}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {filteredLogs.length > 0 && (
                <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLogs.length)} of {filteredLogs.length} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <Icon name="ChevronLeft" size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                                    Math.max(0, currentPage - 2),
                                    Math.min(totalPages, currentPage + 1)
                                ).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`w-10 h-10 rounded-xl font-medium text-sm transition-all ${currentPage === page
                                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <Icon name="ChevronRight" size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
