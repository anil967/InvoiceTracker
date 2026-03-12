'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Card from '@/components/ui/Card';
import Icon from '@/components/Icon';

const UNITS = ['HOUR', 'DAY', 'FIXED', 'MONTHLY'];
const EXPERIENCE_RANGES = ['0-5', '5-10', '10+'];
const ROLE_CODES = ['v11', 'v12', 'v13', 'v14'];

const statusConfig = {
    ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60', ring: 'ring-emerald-500/20' },
    EXPIRED: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/60', ring: 'ring-rose-500/20' },
    DRAFT: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/60', ring: 'ring-amber-500/20' },
};

export default function RateCardManagementPage() {
    const [ratecards, setRatecards] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterVendor, setFilterVendor] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [formData, setFormData] = useState({
        vendorId: '',
        name: '',
        effectiveFrom: '',
        effectiveTo: '',
        notes: '',
        rates: [{ role: '', roleCode: 'v11', experienceRange: '5-10', unit: 'HOUR', rate: '', currency: 'INR' }]
    });

    const stats = useMemo(() => {
        const total = ratecards.length;
        const active = ratecards.filter(r => r.status === 'ACTIVE').length;
        const uniqueVendors = new Set(ratecards.map(r => r.vendorId)).size;
        const totalRates = ratecards.reduce((sum, r) => sum + (r.rates?.length || 0), 0);
        return { total, active, uniqueVendors, totalRates };
    }, [ratecards]);

    useEffect(() => {
        fetchRatecards();
        fetchVendors();
    }, [filterVendor, filterStatus]);

    const fetchRatecards = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterVendor) params.append('vendorId', filterVendor);
            if (filterStatus) params.append('status', filterStatus);

            const res = await fetch(`/api/admin/ratecards?${params}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setRatecards(data.ratecards || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const res = await fetch('/api/vendors', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) setVendors(data.vendors || []);
        } catch (err) {
            console.error('Error fetching vendors:', err);
        }
    };

    const handleCreateRatecard = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/ratecards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    rates: formData.rates.filter(r => r.role && r.rate)
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShowCreateModal(false);
            resetForm();
            fetchRatecards();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateRatecard = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/admin/ratecards/${editingCard.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    rates: formData.rates.filter(r => r.role && r.rate)
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setEditingCard(null);
            resetForm();
            fetchRatecards();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleArchive = async (card) => {
        if (!confirm(`Archive rate card "${card.name}"?`)) return;
        try {
            const res = await fetch(`/api/admin/ratecards/${card.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permanent: false })
            });
            if (!res.ok) throw new Error('Failed to archive');
            fetchRatecards();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (card) => {
        const confirmed = confirm(`Permanently delete rate card "${card.name}"? This action cannot be undone.`);
        console.log('Delete confirmation:', confirmed);

        if (!confirmed) {
            console.log('Delete cancelled by user');
            return;
        }

        try {
            console.log('Attempting to delete rate card:', card.id);
            const res = await fetch(`/api/admin/ratecards/${card.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permanent: true })
            });

            const data = await res.json();
            console.log('Delete response:', res.status, data);

            if (!res.ok) throw new Error(data.error || 'Failed to delete');
            fetchRatecards();
        } catch (err) {
            console.error('Delete error:', err);
            setError(err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            vendorId: '',
            name: '',
            effectiveFrom: '',
            effectiveTo: '',
            notes: '',
            rates: [{ role: '', roleCode: 'v11', experienceRange: '5-10', unit: 'HOUR', rate: '', currency: 'INR' }]
        });
    };

    const openEditModal = (card) => {
        setFormData({
            vendorId: card.vendorId,
            name: card.name,
            effectiveFrom: card.effectiveFrom ? card.effectiveFrom.split('T')[0] : '',
            effectiveTo: card.effectiveTo ? card.effectiveTo.split('T')[0] : '',
            notes: card.notes || '',
            rates: card.rates.length ? card.rates.map(r => ({
                role: r.role || '',
                roleCode: r.roleCode || 'v11',
                experienceRange: r.experienceRange || '5-10',
                unit: r.unit || 'HOUR',
                rate: r.rate || '',
                currency: r.currency || 'INR'
            })) : [{ role: '', roleCode: 'v11', experienceRange: '5-10', unit: 'HOUR', rate: '', currency: 'INR' }]
        });
        setEditingCard(card);
    };

    const addRateRow = () => {
        setFormData({
            ...formData,
            rates: [...formData.rates, { role: '', roleCode: 'v11', experienceRange: '5-10', unit: 'HOUR', rate: '', currency: 'INR' }]
        });
    };

    const updateRate = (idx, field, value) => {
        const newRates = [...formData.rates];
        newRates[idx] = { ...newRates[idx], [field]: value };
        setFormData({ ...formData, rates: newRates });
    };

    const removeRate = (idx) => {
        setFormData({
            ...formData,
            rates: formData.rates.filter((_, i) => i !== idx)
        });
    };

    const statCards = [
        { label: 'Total Cards', value: stats.total, icon: 'Layers', gradient: 'from-purple-600 to-indigo-600', shadow: 'shadow-purple-500/20' },
        { label: 'Active', value: stats.active, icon: 'CheckCircle', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
        { label: 'Vendors', value: stats.uniqueVendors, icon: 'Building', gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
        { label: 'Rate Lines', value: stats.totalRates, icon: 'TrendingUp', gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    ];

    return (
        <div className="py-6 sm:py-8 min-h-screen">
            <PageHeader
                title="Rate Management"
                subtitle="Standardize vendor service rates"
                icon="Layers"
                accent="purple"
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {statCards.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4 flex items-center gap-3.5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <div className={`w-11 h-11 rounded-xl bg-linear-to-br ${stat.gradient} ${stat.shadow} shadow-lg flex items-center justify-center shrink-0`}>
                                <Icon name={stat.icon} size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{stat.value}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filters & Actions */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Icon name="Building" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select
                                    value={filterVendor}
                                    onChange={(e) => setFilterVendor(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50/80 border border-slate-200/60 rounded-xl text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">All Vendors</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.vendorCode ? `${v.vendorCode} · ${v.name}` : v.name}</option>
                                    ))}
                                </select>
                                <Icon name="ChevronDown" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <div className="relative w-full sm:w-48">
                                <Icon name="Filter" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50/80 border border-slate-200/60 rounded-xl text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">All Status</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="EXPIRED">Expired</option>
                                    <option value="DRAFT">Draft</option>
                                </select>
                                <Icon name="ChevronDown" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowCreateModal(true); }}
                            className="w-full sm:w-auto px-6 py-3 bg-linear-to-br from-purple-600 to-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="Plus" size={14} /> Create Rate Card
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="AlertTriangle" size={16} />
                                <span className="font-bold text-sm">{error}</span>
                            </div>
                            <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors">
                                <Icon name="X" size={14} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rate Cards Grid */}
                {loading ? (
                    <div className="text-center py-24">
                        <div className="inline-flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-400/20 rounded-full blur-xl animate-pulse" />
                                <span className="loading loading-spinner h-10 w-10 text-purple-600 relative z-10"></span>
                            </div>
                            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Loading rate cards...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {ratecards.map((card, idx) => {
                            const sc = statusConfig[card.status] || statusConfig.DRAFT;
                            return (
                                <motion.div
                                    key={card.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                                    className="group"
                                >
                                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
                                        {/* Accent Strip */}
                                        <div className="h-1.5 bg-linear-to-r from-purple-500 via-indigo-500 to-blue-500" />

                                        {/* Card Header */}
                                        <div className="p-5 pb-4">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/10 to-indigo-500/10 border border-purple-100/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                        <Icon name="CreditCard" size={18} className="text-purple-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-black text-slate-800 tracking-tight truncate leading-tight" title={card.name}>
                                                            {card.name}
                                                        </h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                                                            {card.vendorName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${sc.bg} ${sc.text} ${sc.border} border ring-1 ${sc.ring} shrink-0`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {card.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Rates Table */}
                                        <div className="px-5 flex-1">
                                            <div className="bg-slate-50/80 rounded-xl border border-slate-100/80 overflow-hidden">
                                                {/* Table Header */}
                                                <div className="grid grid-cols-4 gap-2 px-3.5 py-2 bg-slate-100/60 border-b border-slate-100">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Role</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Code</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Experience</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Rate</p>
                                                </div>
                                                {/* Table Body */}
                                                <div className="max-h-36 overflow-y-auto">
                                                    {card.rates.map((rate, i) => (
                                                        <div key={i} className={`grid grid-cols-4 gap-2 px-3.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-white/80 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                                                            <span className="text-xs font-bold text-slate-700 truncate" title={rate.role}>{rate.role}</span>
                                                            <span className="text-xs font-bold text-slate-600 truncate">{rate.roleCode || '-'}</span>
                                                            <span className="text-xs font-medium text-slate-500 truncate">{rate.experienceRange}</span>
                                                            <span className="text-xs font-black text-purple-600 text-right whitespace-nowrap">
                                                                ₹{Number(rate.rate).toLocaleString()}<span className="text-[9px] text-slate-400 font-bold">/{rate.unit}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {card.rates.length === 0 && (
                                                        <div className="px-3.5 py-4 text-center text-xs text-slate-400 font-medium">No rates defined</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="p-4 pt-3 mt-auto">
                                            <div className="flex gap-2">
                                                {card.status !== 'EXPIRED' && (
                                                    <button
                                                        onClick={() => openEditModal(card)}
                                                        className="flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/80 border border-indigo-100 rounded-xl hover:bg-indigo-100 hover:border-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Icon name="Edit3" size={12} /> Edit
                                                    </button>
                                                )}
                                                {card.status !== 'EXPIRED' && (
                                                    <button
                                                        onClick={() => handleArchive(card)}
                                                        className="flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50/80 border border-amber-100 rounded-xl hover:bg-amber-100 hover:border-amber-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Icon name="Archive" size={12} /> Archive
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(card)}
                                                    className="flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-red-600 bg-red-50/80 border border-red-100 rounded-xl hover:bg-red-100 hover:border-red-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Icon name="Trash2" size={12} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {!loading && ratecards.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-lg text-center py-20 flex flex-col items-center"
                    >
                        <div className="w-20 h-20 bg-linear-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center text-purple-300 mb-5 border border-purple-100/50 shadow-inner">
                            <Icon name="Layers" size={36} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">No Rate Cards Found</h3>
                        <p className="text-slate-400 text-sm mt-2 max-w-sm font-medium leading-relaxed">
                            Define your first set of standard rates to get started with vendor management.
                        </p>
                        <button
                            onClick={() => { resetForm(); setShowCreateModal(true); }}
                            className="mt-8 px-8 py-3.5 bg-linear-to-br from-purple-600 to-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            Create First Card
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {(showCreateModal || editingCard) && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-100 p-4 overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="bg-white rounded-[28px] w-full max-w-3xl shadow-2xl border border-slate-100 my-auto overflow-hidden"
                        >
                            {/* Modal Header Accent */}
                            <div className="h-1.5 bg-linear-to-r from-purple-500 via-indigo-500 to-blue-500" />

                            <div className="p-6 sm:p-9">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500/10 to-indigo-500/10 border border-purple-100/50 flex items-center justify-center">
                                                <Icon name="CreditCard" size={16} className="text-purple-600" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                                                {editingCard ? 'Edit Rate Card' : 'New Rate Card'}
                                            </p>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                            {editingCard ? 'Modify Rate Card' : 'Define New Rate Card'}
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => { setShowCreateModal(false); setEditingCard(null); }}
                                        className="p-2.5 hover:bg-slate-50 rounded-xl transition-all active:scale-90 group"
                                    >
                                        <Icon name="X" size={18} className="text-slate-400 group-hover:text-slate-600" />
                                    </button>
                                </div>

                                <form onSubmit={editingCard ? handleUpdateRatecard : handleCreateRatecard} className="space-y-7">
                                    {/* Basic Info Section */}
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center">
                                                <Icon name="Info" size={11} className="text-purple-600" />
                                            </div>
                                            Basic Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Assign Vendor</label>
                                                <div className="relative">
                                                    <Icon name="Building" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <select
                                                        value={formData.vendorId}
                                                        onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                                                        required
                                                        disabled={!!editingCard}
                                                        className="w-full pl-11 pr-8 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="">Select a vendor...</option>
                                                        {vendors.map(v => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.vendorCode ? `${v.vendorCode} · ${v.name}` : v.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Icon name="ChevronDown" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Card Name</label>
                                                <div className="relative">
                                                    <Icon name="Tag" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        required
                                                        placeholder="e.g. Standard 2026 Rates"
                                                        className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Effective Dates Section */}
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
                                                <Icon name="Calendar" size={11} className="text-blue-600" />
                                            </div>
                                            Effective Period
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Start Date</label>
                                                <div className="relative">
                                                    <Icon name="Calendar" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        value={formData.effectiveFrom}
                                                        onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                                                        className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">End Date (Optional)</label>
                                                <div className="relative">
                                                    <Icon name="Calendar" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        value={formData.effectiveTo}
                                                        onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                                                        className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rates Configuration */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center">
                                                    <Icon name="DollarSign" size={11} className="text-emerald-600" />
                                                </div>
                                                Rate Configuration
                                                <span className="ml-1 px-2 py-0.5 bg-slate-100 rounded-md text-[9px] text-slate-500">{formData.rates.length} rows</span>
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={addRateRow}
                                                className="px-3.5 py-1.5 bg-purple-50 text-purple-600 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-purple-100 transition-all active:scale-95 border border-purple-100 flex items-center gap-1.5"
                                            >
                                                <Icon name="PlusCircle" size={13} /> Add Row
                                            </button>
                                        </div>

                                        <div className="bg-slate-50/80 rounded-xl border border-slate-200/60 overflow-hidden">
                                            {/* Table Header */}
                                            <div className="hidden sm:grid grid-cols-[1fr_100px_140px_110px_110px_36px] gap-2 px-4 py-2.5 bg-slate-100/80 border-b border-slate-200/60">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Role</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Code</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Experience</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Rate (₹)</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Unit</p>
                                                <p></p>
                                            </div>
                                            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                                {formData.rates.map((rate, idx) => (
                                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_140px_110px_110px_36px] gap-2 sm:gap-2 p-3 sm:px-4 sm:py-2.5 hover:bg-white/60 transition-colors items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="Role (e.g. Senior Developer)"
                                                            value={rate.role}
                                                            onChange={(e) => updateRate(idx, 'role', e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                                        />
                                                        <div className="relative">
                                                            <select
                                                                value={rate.roleCode}
                                                                onChange={(e) => updateRate(idx, 'roleCode', e.target.value)}
                                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none"
                                                            >
                                                                {ROLE_CODES.map(code => (
                                                                    <option key={code} value={code}>{code}</option>
                                                                ))}
                                                            </select>
                                                            <Icon name="ChevronDown" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                        <div className="relative">
                                                            <select
                                                                value={rate.experienceRange}
                                                                onChange={(e) => updateRate(idx, 'experienceRange', e.target.value)}
                                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none"
                                                            >
                                                                {EXPERIENCE_RANGES.map(range => (
                                                                    <option key={range} value={range}>{range}</option>
                                                                ))}
                                                            </select>
                                                            <Icon name="ChevronDown" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                        <div className="relative">
                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                                            <input
                                                                type="number"
                                                                placeholder="Rate"
                                                                value={rate.rate}
                                                                onChange={(e) => updateRate(idx, 'rate', e.target.value)}
                                                                className="w-full pl-6 pr-2 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                                            />
                                                        </div>
                                                        <div className="relative">
                                                            <select
                                                                value={rate.unit}
                                                                onChange={(e) => updateRate(idx, 'unit', e.target.value)}
                                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all appearance-none"
                                                            >
                                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                            <Icon name="ChevronDown" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRate(idx)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all justify-self-center"
                                                        >
                                                            <Icon name="Trash2" size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Additional Notes</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            placeholder="Add any specific terms or context here..."
                                            className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all resize-none"
                                        />
                                    </div>

                                    {/* Modal Actions */}
                                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => { setShowCreateModal(false); setEditingCard(null); }}
                                            className="flex-1 px-6 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-6 py-3.5 bg-linear-to-br from-purple-600 to-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.01] transition-all active:scale-95"
                                        >
                                            {editingCard ? 'Commit Update' : 'Create Rate Card'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
