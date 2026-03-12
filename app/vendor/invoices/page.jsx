'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VendorInvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [statusCounts, setStatusCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, [filterStatus]);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);

            const res = await fetch(`/api/vendor/invoices?${params}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setInvoices(data.invoices || []);
            setStatusCounts(data.statusCounts || {});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': case 'APPROVED': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'Rejected': case 'REJECTED': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'Info Requested': case 'INFO_REQUESTED': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'PM Approved': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
            default: return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        }
    };

    const getStageIcon = (stage) => {
        if (stage.completed) return '✅';
        if (stage.status === 'REJECTED' || stage.status === 'FLAGGED') return '❌';
        if (stage.status === 'INFO_REQUESTED') return '❓';
        return '⏳';
    };

    return (
        <div className="min-h-screen bg-linear-to-r from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">My Invoices</h1>
                    <p className="text-gray-400">Track the status of your submitted invoices</p>
                </motion.div>

                {/* Status Summary Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
                >
                    <div
                        onClick={() => setFilterStatus('')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${!filterStatus ? 'bg-white/20 border-white/50' : 'bg-white/10 border-white/10 hover:border-white/30'
                            }`}
                    >
                        <p className="text-white text-2xl font-bold">{statusCounts.total || 0}</p>
                        <p className="text-gray-400 text-sm">Total</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('Pending')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${filterStatus === 'Pending' ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-white/10 border-white/10 hover:border-yellow-500/30'
                            }`}
                    >
                        <p className="text-yellow-400 text-2xl font-bold">{statusCounts.pending || 0}</p>
                        <p className="text-gray-400 text-sm">Pending</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('PM Approved')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${filterStatus === 'PM Approved' ? 'bg-purple-500/20 border-purple-500/50' : 'bg-white/10 border-white/10 hover:border-purple-500/30'
                            }`}
                    >
                        <p className="text-purple-400 text-2xl font-bold">{statusCounts.pmApproved || 0}</p>
                        <p className="text-gray-400 text-sm">PM Approved</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('Approved')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${filterStatus === 'Approved' ? 'bg-green-500/20 border-green-500/50' : 'bg-white/10 border-white/10 hover:border-green-500/30'
                            }`}
                    >
                        <p className="text-green-400 text-2xl font-bold">{statusCounts.approved || 0}</p>
                        <p className="text-gray-400 text-sm">Approved</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('Info Requested')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${filterStatus === 'Info Requested' ? 'bg-blue-500/20 border-blue-500/50' : 'bg-white/10 border-white/10 hover:border-blue-500/30'
                            }`}
                    >
                        <p className="text-blue-400 text-2xl font-bold">{statusCounts.infoRequested || 0}</p>
                        <p className="text-gray-400 text-sm">Info Needed</p>
                    </div>
                </motion.div>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6"
                        >
                            {error}
                            <button onClick={() => setError(null)} className="float-right">×</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Invoice List */}
                {loading ? (
                    <div className="text-center text-gray-400 py-12">Loading invoices...</div>
                ) : (
                    <div className="space-y-4">
                        {invoices.map((invoice, idx) => (
                            <motion.div
                                key={invoice.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer"
                                onClick={() => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-3">
                                            <h3 className="text-lg font-semibold text-white">
                                                {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                                                {invoice.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-400">Amount</p>
                                                <p className="text-white font-medium">₹ {invoice.amount?.toLocaleString() || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Date</p>
                                                <p className="text-white">{invoice.date || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Submitted</p>
                                                <p className="text-white">{new Date(invoice.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Progress</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-linear-to- from-purple-500 to-pink-500 transition-all"
                                                            style={{ width: `${invoice.progressPercent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white text-xs">{invoice.progressPercent}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="text-gray-400 hover:text-white ml-4">
                                        {selectedInvoice?.id === invoice.id ? '▲' : '▼'}
                                    </button>
                                </div>

                                {/* Expanded Status Timeline */}
                                <AnimatePresence>
                                    {selectedInvoice?.id === invoice.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-6 pt-6 border-t border-white/10"
                                        >
                                            <h4 className="text-sm font-medium text-gray-300 mb-4">Approval Timeline</h4>
                                            <div className="flex justify-between items-center">
                                                {invoice.stages.map((stage, i) => (
                                                    <div key={i} className="flex flex-col items-center flex-1">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${stage.completed ? 'bg-green-500/20' :
                                                            stage.status === 'REJECTED' ? 'bg-red-500/20' :
                                                                'bg-white/10'
                                                            }`}>
                                                            {getStageIcon(stage)}
                                                        </div>
                                                        <p className={`mt-2 text-xs text-center ${stage.completed ? 'text-green-400' : 'text-gray-400'}`}>
                                                            {stage.name}
                                                        </p>
                                                        {i < invoice.stages.length - 1 && (
                                                            <div className={`absolute h-0.5 w-full ${stage.completed ? 'bg-green-500' : 'bg-white/10'}`}
                                                                style={{ left: '50%', top: '50%', transform: 'translateY(-50%)' }} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!loading && invoices.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-400 mb-4">No invoices found</p>
                        <a href="/vendor/submit" className="text-purple-400 hover:text-purple-300 underline">
                            Submit your first invoice →
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
