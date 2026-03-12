'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { ROLES, getNormalizedRole } from '@/constants/roles';

export default function AdminMessagesPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [senderRoleFilter, setSenderRoleFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedThreadId, setSelectedThreadId] = useState(null);

    // Guard: only Admin can access this page
    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && (!user || role !== ROLES.ADMIN)) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (searchTerm) params.set('search', searchTerm);
            if (senderRoleFilter) params.set('senderRole', senderRoleFilter);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const queryString = params.toString();
            const url = `/api/admin/messages${queryString ? `?${queryString}` : ''}`;

            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load messages');
            }

            setMessages(data.messages || []);
        } catch (err) {
            console.error('Error fetching admin messages:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && role === ROLES.ADMIN) {
            fetchMessages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading]);

    const handleApplyFilters = (e) => {
        e.preventDefault();
        fetchMessages();
    };

    const groupedThreads = useMemo(() => {
        const threads = new Map();
        for (const msg of messages) {
            const threadKey = msg.threadId || msg.id;
            if (!threads.has(threadKey)) {
                threads.set(threadKey, []);
            }
            threads.get(threadKey).push(msg);
        }
        return Array.from(threads.entries())
            .map(([threadId, msgs]) => {
                const sorted = [...msgs].sort(
                    (a, b) => new Date(a.created_at) - new Date(b.created_at)
                );
                const latest = sorted[sorted.length - 1];

                // Derive PM and Vendor names for thread label
                const pmMessage = sorted.find(m => m.senderRole === ROLES.PROJECT_MANAGER);
                const vendorMessage = sorted.find(m => m.senderRole === ROLES.VENDOR);

                const pmName = pmMessage
                    ? pmMessage.senderName
                    : vendorMessage
                        ? vendorMessage.recipientName
                        : 'PM';
                const vendorName = vendorMessage
                    ? vendorMessage.senderName
                    : pmMessage
                        ? pmMessage.recipientName
                        : 'Vendor';

                return {
                    threadId,
                    messages: sorted,
                    latest,
                    pmName,
                    vendorName
                };
            })
            .sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at));
    }, [messages]);

    const selectedThread = useMemo(() => {
        if (!selectedThreadId) return null;
        return groupedThreads.find(t => t.threadId === selectedThreadId) || null;
    }, [groupedThreads, selectedThreadId]);

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
                title="Messages Monitor"
                icon="Mail"
                accent="purple"
                // Admin is already the logged-in role, so no extra actions/sign-out changes needed
            />

            <div className="max-w-6xl mx-auto space-y-6 px-2 sm:px-0">
                {/* Filters */}
                <form
                    onSubmit={handleApplyFilters}
                    className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-sm space-y-4"
                >
                    <div className="flex flex-col md:flex-row gap-4 md:items-end">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                Search content
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search message content or subject..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                Sender Role
                            </label>
                            <select
                                value={senderRoleFilter}
                                onChange={(e) => setSenderRoleFilter(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 text-sm"
                            >
                                <option value="">All</option>
                                <option value={ROLES.PROJECT_MANAGER}>PM</option>
                                <option value={ROLES.VENDOR}>Vendor</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                From Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                To Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 text-sm"
                            />
                        </div>

                        <div className="flex md:block pt-2 md:pt-0">
                            <button
                                type="submit"
                                className="w-full md:w-auto px-6 py-3 bg-linear-to-br from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Icon name="Search" size={16} /> Apply Filters
                            </button>
                        </div>
                    </div>
                </form>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                            <span className="font-medium text-sm">{error}</span>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                className="p-1 hover:bg-rose-100 rounded-lg"
                            >
                                ✕
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Messages Table - grouped by thread (conversation) */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-16 text-center">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                            <p className="mt-4 text-slate-500 font-medium">Loading messages...</p>
                        </div>
                    ) : groupedThreads.length === 0 ? (
                        <div className="p-16 text-center text-slate-500">
                            No PM–Vendor messages found for the selected filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200/80">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Conversation
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Last Message
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            From → To
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Date & Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {groupedThreads.map((thread, idx) => {
                                        const last = thread.latest;
                                        const fromRole =
                                            last.senderRole === ROLES.PROJECT_MANAGER ? 'PM' : 'Vendor';
                                        const toRole =
                                            last.senderRole === ROLES.PROJECT_MANAGER ? 'Vendor' : 'PM';

                                        return (
                                            <motion.tr
                                                key={thread.threadId}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-slate-50 cursor-pointer"
                                                onClick={() => setSelectedThreadId(thread.threadId)}
                                            >
                                                <td className="px-4 py-4 align-top">
                                                    <p className="text-xs font-semibold text-slate-700">
                                                        PM: <span className="font-bold">{thread.pmName}</span>
                                                    </p>
                                                    <p className="text-xs font-semibold text-slate-600">
                                                        Vendor:{' '}
                                                        <span className="font-bold">{thread.vendorName}</span>
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 align-top max-w-xs">
                                                    <p className="text-xs text-slate-600 line-clamp-2">
                                                        {last.content}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    <p className="text-xs font-semibold text-slate-700">
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest mr-1">
                                                            {fromRole}
                                                        </span>
                                                        <span className="font-bold">{last.senderName}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        →
                                                        <span className="px-2 py-0.5 ml-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest mr-1">
                                                            {toRole}
                                                        </span>
                                                        <span className="font-semibold">{last.recipientName}</span>
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 align-top whitespace-nowrap text-xs text-slate-500">
                                                    {new Date(last.created_at).toLocaleString()}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Thread Detail Modal (read-only) */}
                <AnimatePresence>
                    {selectedThread && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                            PM ↔ Vendor Conversation
                                        </p>
                                        <h2 className="text-lg font-black text-slate-800">
                                            {selectedThread.pmName} (PM) &nbsp;↔&nbsp; {selectedThread.vendorName} (Vendor)
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedThreadId(null)}
                                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                                    >
                                        <Icon name="X" size={20} className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedThread.messages.map((msg) => {
                                        const isPM = msg.senderRole === ROLES.PROJECT_MANAGER;
                                        const senderRoleLabel = isPM ? 'PM' : 'Vendor';
                                        const receiverRoleLabel = isPM ? 'Vendor' : 'PM';

                                        return (
                                            <div
                                                key={msg.id}
                                                className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                                                            {senderRoleLabel}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-800">
                                                            {msg.senderName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 mx-1">→</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest">
                                                            {receiverRoleLabel}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-700">
                                                            {msg.recipientName}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                        {new Date(msg.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                {msg.subject && (
                                                    <p className="text-xs font-semibold text-slate-700 mb-1">
                                                        Subject: {msg.subject}
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedThreadId(null)}
                                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

