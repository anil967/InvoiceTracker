'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Card from '@/components/ui/Card';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';

const MESSAGE_TYPES = [
    { value: 'GENERAL', label: 'General', color: 'gray' },
    { value: 'INFO_REQUEST', label: 'Info Request', color: 'blue' },
    { value: 'CLARIFICATION', label: 'Clarification', color: 'yellow' },
    { value: 'APPROVAL_NOTIFICATION', label: 'Approval Notice', color: 'green' },
];

export default function DivHeadMessagesPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [recipients, setRecipients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState('inbox');
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    const [composeData, setComposeData] = useState({
        recipientId: '',
        subject: '',
        content: '',
        messageType: 'GENERAL',
        invoiceId: ''
    });

    const fetchRecipients = async () => {
        try {
            const res = await fetch('/api/div-head/messages/recipients', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setRecipients(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch recipients', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMessages();
            fetchRecipients();
        }
    }, [user, activeTab]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/div-head/messages?type=${activeTab}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessages(data.messages || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/div-head/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(composeData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShowComposeModal(false);
            setComposeData({ recipientId: '', subject: '', content: '', messageType: 'GENERAL', invoiceId: '' });
            fetchMessages();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleMarkAsRead = async (messageId) => {
        try {
            await fetch('/api/div-head/messages', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageIds: [messageId] })
            });
            fetchMessages();
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const getTypeClasses = (type) => {
        switch (type) {
            case 'INFO_REQUEST': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'CLARIFICATION': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'APPROVAL_NOTIFICATION': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'DOCUMENT_REQUEST': return 'bg-purple-50 text-purple-600 border-purple-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const deptHeads = recipients.filter(r => r.type === 'DeptHead');

    return (
        <div className="pb-10">
            <PageHeader
                title="Messages"
                subtitle="Communicate with Department Heads"
                icon="Mail"
                accent="indigo"
            />

            <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
                {/* Tabs & Compose Button */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'inbox'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Inbox {unreadCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] rounded-lg">{unreadCount}</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('sent')}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'sent'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Sent
                        </button>
                    </div>

                    <button
                        onClick={() => setShowComposeModal(true)}
                        className="w-full sm:w-auto px-8 py-3 bg-linear-to-br from-indigo-600 to-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Icon name="Plus" size={16} /> Compose Message
                    </button>
                </div>

                {/* Error */}
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                            <span className="font-medium text-sm">{error}</span>
                            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg">✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Messages List */}
                <Card className="overflow-hidden border-slate-200/60 p-0">
                    {loading ? (
                        <div className="p-20 text-center">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                            <p className="mt-4 text-slate-500 font-medium">Loading messages...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {messages.map((message, idx) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    onClick={() => {
                                        setSelectedMessage(message);
                                        if (!message.isRead && activeTab === 'inbox') {
                                            handleMarkAsRead(message.id);
                                        }
                                    }}
                                    className={`p-5 sm:p-6 hover:bg-slate-50 cursor-pointer transition-colors relative group ${!message.isRead && activeTab === 'inbox' ? 'bg-indigo-50/30' : ''}`}
                                >
                                    <div className="flex gap-4 sm:gap-6 items-start">
                                        <div className="shrink-0 pt-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${!message.isRead && activeTab === 'inbox' ? 'bg-indigo-600 border-indigo-100 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-white group-hover:border-indigo-200 transition-colors'}`}>
                                                <Icon name={activeTab === 'inbox' ? "User" : "Send"} size={18} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-sm font-black ${!message.isRead && activeTab === 'inbox' ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {activeTab === 'inbox' ? message.senderName : message.recipientName}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getTypeClasses(message.messageType)}`}>
                                                        {message.messageType.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                    {new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <h4 className={`text-sm mb-1 line-clamp-1 ${!message.isRead && activeTab === 'inbox' ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                {message.subject || '(no subject)'}
                                            </h4>
                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                {message.content}
                                            </p>
                                        </div>
                                        {!message.isRead && activeTab === 'inbox' && (
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-600 rounded-full shadow-sm shadow-indigo-200"></div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                    {!loading && messages.length === 0 && (
                        <div className="p-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Icon name="Inbox" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">No messages found</h3>
                            <p className="text-slate-500 mt-1">Your {activeTab} is currently empty.</p>
                        </div>
                    )}
                </Card>

                {/* Compose Modal */}
                <AnimatePresence>
                    {showComposeModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-100 p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Divisional Head</p>
                                        <h3 className="text-xl font-bold text-slate-800">Compose Message</h3>
                                    </div>
                                    <button onClick={() => setShowComposeModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                        <Icon name="X" size={20} className="text-slate-400" />
                                    </button>
                                </div>

                                <form onSubmit={handleSendMessage} className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                                Recipient
                                            </label>
                                            <select
                                                required
                                                value={composeData.recipientId}
                                                onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm appearance-none"
                                            >
                                                <option value="">Select Recipient</option>
                                                {deptHeads.length > 0 && (
                                                    <optgroup label="Department Heads">
                                                        {deptHeads.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {admins.length > 0 && (
                                                    <optgroup label="Admins">
                                                        {admins.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Message Category</label>
                                            <select
                                                value={composeData.messageType}
                                                onChange={(e) => setComposeData({ ...composeData, messageType: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                                            >
                                                {MESSAGE_TYPES.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Subject Line</label>
                                        <input
                                            type="text"
                                            value={composeData.subject}
                                            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                            placeholder="What is this regarding?"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Message Content</label>
                                        <textarea
                                            required
                                            value={composeData.content}
                                            onChange={(e) => setComposeData({ ...composeData, content: e.target.value })}
                                            rows={5}
                                            placeholder="Type your message here..."
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm resize-none"
                                        />
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowComposeModal(false)}
                                            className="order-2 sm:order-1 flex-1 px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Discard Draft
                                        </button>
                                        <button
                                            type="submit"
                                            className="order-1 sm:order-2 flex-1 px-6 py-4 bg-linear-to-br from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Icon name="Send" size={16} /> Send Message
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Message Detail Modal */}
                <AnimatePresence>
                    {selectedMessage && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-100 p-4">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getTypeClasses(selectedMessage.messageType)}`}>
                                                {selectedMessage.messageType.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                {new Date(selectedMessage.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight leading-snug">
                                            {selectedMessage.subject || '(no subject)'}
                                        </h2>
                                    </div>
                                    <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors ml-4">
                                        <Icon name="X" size={20} className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                        <Icon name="User" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                            {activeTab === 'sent' ? 'Recipient' : 'Sender / From'}
                                        </p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {activeTab === 'sent' ? selectedMessage.recipientName : selectedMessage.senderName}
                                        </p>
                                        <p className="text-[10px] font-medium text-slate-400 capitalize">{selectedMessage.senderRole}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 rounded-2xl p-6 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap border border-slate-100">
                                    {selectedMessage.content}
                                </div>

                                {selectedMessage.invoiceId && (
                                    <div className="mt-6 flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <div className="flex items-center gap-3">
                                            <Icon name="FileText" size={18} className="text-indigo-600" />
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Linked Invoice</p>
                                                <p className="text-sm font-bold text-indigo-700">Ref: {selectedMessage.invoiceId}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`/div-head/approval-queue?invoiceId=${selectedMessage.invoiceId}`}
                                            className="px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        >
                                            View Task
                                        </a>
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                    <button
                                        onClick={() => setSelectedMessage(null)}
                                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-95 transition-all"
                                    >
                                        Close Message
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
