'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HILReviewPage() {
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({ pending: 0, reviewed: 0, flagged: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [corrections, setCorrections] = useState({});
    const [reviewNotes, setReviewNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchInvoices();
    }, [filterStatus]);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/finance/hil-review?status=${filterStatus}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setInvoices(Array.isArray(data) ? data : (data.invoices || []));
            setStats(data.stats || { pending: 0, reviewed: 0, flagged: 0 });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openReviewModal = (invoice) => {
        setSelectedInvoice(invoice);
        setCorrections({
            invoiceNumber: invoice.invoiceNumber || '',
            amount: invoice.amount || '',
            date: invoice.date || '',
            vendorName: invoice.vendorName || ''
        });
        setReviewNotes('');
    };

    const submitReview = async (status) => {
        if (!selectedInvoice) return;

        try {
            setSubmitting(true);
            const res = await fetch('/api/finance/hil-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: selectedInvoice.id,
                    status,
                    corrections,
                    notes: reviewNotes
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSelectedInvoice(null);
            fetchInvoices();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getConfidenceColor = (confidence) => {
        if (!confidence) return 'text-gray-400';
        if (confidence >= 90) return 'text-green-400';
        if (confidence >= 70) return 'text-yellow-400';
        return 'text-red-400';
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
                    <h1 className="text-3xl font-bold text-white mb-2">Human-in-the-Loop Review</h1>
                    <p className="text-gray-400">Verify OCR-extracted data and correct discrepancies</p>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                >
                    <div
                        onClick={() => setFilterStatus('PENDING')}
                        className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterStatus === 'PENDING'
                            ? 'bg-yellow-500/20 border-yellow-500/50'
                            : 'bg-white/10 border-white/10 hover:border-yellow-500/30'
                            }`}
                    >
                        <p className="text-yellow-400 text-3xl font-bold">{stats.pending}</p>
                        <p className="text-gray-300">Pending Review</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('REVIEWED')}
                        className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterStatus === 'REVIEWED'
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-white/10 border-white/10 hover:border-green-500/30'
                            }`}
                    >
                        <p className="text-green-400 text-3xl font-bold">{stats.reviewed}</p>
                        <p className="text-gray-300">Reviewed</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('FLAGGED')}
                        className={`cursor-pointer p-6 rounded-2xl border transition-all ${filterStatus === 'FLAGGED'
                            ? 'bg-red-500/20 border-red-500/50'
                            : 'bg-white/10 border-white/10 hover:border-red-500/30'
                            }`}
                    >
                        <p className="text-red-400 text-3xl font-bold">{stats.flagged}</p>
                        <p className="text-gray-300">Flagged</p>
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
                                className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-3">
                                            <h3 className="text-lg font-semibold text-white">
                                                {invoice.invoiceNumber || 'No Invoice #'}
                                            </h3>
                                            <span className={`text-sm font-medium ${getConfidenceColor(invoice.hilReview?.confidence)}`}>
                                                {invoice.hilReview?.confidence
                                                    ? `${invoice.hilReview.confidence}% confidence`
                                                    : 'No confidence score'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-400">Vendor</p>
                                                <p className="text-white">{invoice.vendorCode && <span className="font-mono text-purple-300 mr-1">{invoice.vendorCode}</span>}{invoice.vendorName}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Amount</p>
                                                <p className="text-white">₹ {invoice.amount?.toLocaleString() || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Date</p>
                                                <p className="text-white">{invoice.date || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400">Status</p>
                                                <span className={`px-2 py-1 rounded-full text-xs ${invoice.hilReview?.status === 'REVIEWED' ? 'bg-green-500/20 text-green-300' :
                                                    invoice.hilReview?.status === 'FLAGGED' ? 'bg-red-500/20 text-red-300' :
                                                        'bg-yellow-500/20 text-yellow-300'
                                                    }`}>
                                                    {invoice.hilReview?.status || 'PENDING'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openReviewModal(invoice)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors ml-4"
                                    >
                                        Review
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!loading && invoices.length === 0 && (
                    <div className="text-center text-gray-400 py-12">
                        No invoices {filterStatus !== 'ALL' ? `with status "${filterStatus}"` : ''} found
                    </div>
                )}

                {/* Review Modal */}
                <AnimatePresence>
                    {selectedInvoice && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                            onClick={() => setSelectedInvoice(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-800/90 backdrop-blur-xl rounded-2xl p-8 w-full max-w-2xl border border-white/20 max-h-[90vh] overflow-y-auto"
                            >
                                <h2 className="text-2xl font-bold text-white mb-6">Review Invoice</h2>

                                {/* Original vs Editable Fields */}
                                <div className="space-y-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Invoice Number</label>
                                            <input
                                                type="text"
                                                value={corrections.invoiceNumber}
                                                onChange={(e) => setCorrections({ ...corrections, invoiceNumber: e.target.value })}
                                                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Amount (₹)</label>
                                            <input
                                                type="number"
                                                value={corrections.amount}
                                                onChange={(e) => setCorrections({ ...corrections, amount: e.target.value })}
                                                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Invoice Date</label>
                                            <input
                                                type="text"
                                                value={corrections.date}
                                                onChange={(e) => setCorrections({ ...corrections, date: e.target.value })}
                                                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Vendor Name</label>
                                            <input
                                                type="text"
                                                value={corrections.vendorName}
                                                onChange={(e) => setCorrections({ ...corrections, vendorName: e.target.value })}
                                                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={(e) => setReviewNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Add any review notes..."
                                            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                {/* View Original Document Link */}
                                {selectedInvoice.fileUrl && (
                                    <div className="mb-6">
                                        <a
                                            href={selectedInvoice.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-400 hover:text-purple-300 underline"
                                        >
                                            📄 View Original Document
                                        </a>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setSelectedInvoice(null)}
                                        disabled={submitting}
                                        className="flex-1 px-4 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => submitReview('FLAGGED')}
                                        disabled={submitting}
                                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {submitting ? 'Submitting...' : '🚩 Flag for Escalation'}
                                    </button>
                                    <button
                                        onClick={() => submitReview('REVIEWED')}
                                        disabled={submitting}
                                        className="flex-1 px-4 py-3 bg-linear-to- from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        {submitting ? 'Submitting...' : '✓ Mark as Reviewed'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
