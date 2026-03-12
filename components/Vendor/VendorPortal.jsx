"use client";

import { useState, useEffect, useMemo } from "react";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getAllInvoices } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const VendorPortal = ({ onUploadClick }) => {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                const data = await getAllInvoices();
                // Server-side filtering already handles vendor isolation
                setInvoices(data);
            } catch (error) {
                console.error("Failed to fetch vendor invoices", error);
            } finally {
                setLoading(false);
            }
        };

        if (user || !user) fetchInvoices(); // Allow demo flow
        const interval = setInterval(fetchInvoices, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const stats = useMemo(() => {
        const total = invoices.length;
        const paid = invoices.filter(i => i.status === 'PAID').length;
        const pending = invoices.filter(i => !['PAID', 'REJECTED'].includes(i.status)).length;
        const amount = invoices.reduce((sum, i) => sum + (parseFloat(i.amount || i.totalAmount) || 0), 0);
        return { total, paid, pending, amount };
    }, [invoices]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PAID':
            case 'VERIFIED': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
            case 'APPROVED': return 'text-blue-600 bg-blue-50 border-blue-100';
            case 'REJECTED': return 'text-rose-600 bg-rose-50 border-rose-100';
            case 'DIGITIZING':
            case 'RECEIVED':
            case 'MORE_INFO_NEEDED':
            case 'INFO_REQUESTED': return 'text-amber-600 bg-amber-50 border-amber-100';
            default: return 'text-slate-500 bg-slate-50 border-slate-100';
        }
    };

    const handleDownloadCSV = () => {
        if (invoices.length === 0) return;

        const headers = ["Invoice ID", "Date", "Amount", "Status"];
        const csvContent = [
            headers.join(","),
            ...invoices.map(inv => [
                inv.id,
                inv.date || new Date(inv.receivedAt).toLocaleDateString(),
                inv.amount || inv.totalAmount || 0,
                inv.status
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `my_invoices_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* 1. Integrated Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/40">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
                            <Icon name="Activity" size={18} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Intelligence Feed</h1>
                    </div>
                    <p className="text-slate-500 font-medium pl-11">Welcome back, <span className="text-teal-600">{user?.name || "Partner"}</span>. Track your liquidity in real-time.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                    <Button
                        variant="ghost"
                        onClick={handleDownloadCSV}
                        className="h-12 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-2xl px-6 text-xs font-bold uppercase tracking-widest"
                    >
                        Export CSV
                    </Button>
                    <Button
                        variant="primary"
                        icon="UploadCloud"
                        onClick={onUploadClick}
                        className="h-12 flex-1 md:flex-none bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20 rounded-2xl px-8 text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                    >Submit Invoice</Button>
                </div>
            </header>

            {/* 2. Dynamic Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Submissions', value: stats.total, icon: 'FileText', color: 'teal' },
                    { label: 'Paid Items', value: stats.paid, icon: 'CheckCircle', color: 'emerald' },
                    { label: 'Pending Logic', value: stats.pending, icon: 'Clock', color: 'amber' },
                    { label: 'Gross Volume', value: `₹ ${stats.amount.toLocaleString()}`, icon: 'BarChart3', color: 'blue' }
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white/80 p-6 rounded-4xl border border-slate-200/40 shadow-lg shadow-slate-100/50 backdrop-blur-sm relative overflow-hidden group hover:bg-white transition-all"
                    >
                        <div className="flex items-center gap-4 mb-2">
                            <div className={clsx(
                                "p-2 rounded-xl",
                                stat.color === 'teal' && "bg-teal-50 text-teal-600",
                                stat.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                stat.color === 'amber' && "bg-amber-50 text-amber-600",
                                stat.color === 'blue' && "bg-blue-50 text-blue-600",
                            )}>
                                <Icon name={stat.icon} size={18} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        </div>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* 3. Professional Activity Feed */}
            <Card className="overflow-hidden bg-white/60 backdrop-blur-xl border-white/60 rounded-[2.5rem] shadow-2xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                <th className="px-8 py-6">Reference No.</th>
                                <th className="px-6 py-6">Date</th>
                                <th className="px-6 py-6">Value</th>
                                <th className="px-6 py-6 text-center">Workflow</th>
                                <th className="px-8 py-6 text-right">Preview</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-8 py-6 h-20">
                                            <div className="h-full bg-slate-100 rounded-2xl w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <Icon name="Inbox" size={32} className="mx-auto text-slate-300" />
                                            <p className="font-black text-slate-400">No Activity Detected</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {invoices.map((inv, idx) => (
                                        <motion.tr
                                            key={inv.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="group hover:bg-white/80 transition-all cursor-default"
                                        >
                                            <td className="px-8 py-6 font-mono font-bold text-teal-600 text-xs">
                                                {inv.id.slice(0, 15)}...
                                            </td>
                                            <td className="px-6 py-6 text-sm font-medium text-slate-500 italic">
                                                {inv.date || new Date(inv.receivedAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-6 font-black text-slate-800 text-sm">
                                                ₹ {parseFloat(inv.amount || inv.totalAmount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={clsx(
                                                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all",
                                                        getStatusStyle(inv.status)
                                                    )}>
                                                        {inv.status.replace(/_/g, ' ')}
                                                    </span>
                                                    {/* Show Recheck Message if present */}
                                                    {(inv.status === 'MORE_INFO_NEEDED' || inv.status === 'INFO_REQUESTED' || inv.pmApproval?.status === 'INFO_REQUESTED') && (
                                                        <div className="group/tooltip relative">
                                                            <span className="cursor-help flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                                                <Icon name="MessageSquare" size={10} />
                                                                See Message
                                                            </span>
                                                            {inv.pmApproval?.notes && (
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl z-50 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
                                                                    <div className="font-bold mb-1 text-amber-400">PM Request:</div>
                                                                    {inv.pmApproval.notes}
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Show PM approval timestamp */}
                                                    {inv.pmApproval?.approvedAt && inv.pmApproval?.status !== 'INFO_REQUESTED' && (
                                                        <p className="text-[9px] text-slate-400 mt-1">
                                                            PM: {inv.pmApproval?.approvedByName || 'PM'} · {new Date(inv.pmApproval.approvedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    )}
                                                    {/* Show Finance approval timestamp */}
                                                    {inv.financeApproval?.approvedAt && (
                                                        <p className="text-[9px] text-slate-400 mt-0.5">
                                                            Finance: {inv.financeApproval?.approvedByName || 'Finance'} · {new Date(inv.financeApproval.approvedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <Button variant="ghost" size="sm" icon="Eye" className="text-slate-300 hover:text-teal-600 bg-transparent hover:bg-teal-50 rounded-xl" />
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default VendorPortal;
