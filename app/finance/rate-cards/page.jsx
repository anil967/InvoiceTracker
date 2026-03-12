"use client";

import { useState, useEffect, useMemo } from "react";
import Icon from "@/components/Icon";
import { getRateCards } from "@/lib/api";
import PageHeader from "@/components/Layout/PageHeader";
import { motion, AnimatePresence } from "framer-motion";

const statusConfig = {
    ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60', ring: 'ring-emerald-500/20' },
    EXPIRED: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/60', ring: 'ring-rose-500/20' },
    DRAFT: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/60', ring: 'ring-amber-500/20' },
};

export default function FinanceRateCards() {
    const [rateCards, setRateCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                setLoading(true);
                const data = await getRateCards();
                setRateCards(data.ratecards || []);
            } catch (err) {
                console.error("Failed to fetch rate cards", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRates();
    }, []);

    const filteredCards = rateCards.filter(card =>
        (card.name || "").toLowerCase().includes(filter.toLowerCase()) ||
        (card.vendorName || "").toLowerCase().includes(filter.toLowerCase()) ||
        (card.vendorId || "").toLowerCase().includes(filter.toLowerCase())
    );

    const stats = useMemo(() => {
        const total = filteredCards.length;
        const totalRates = filteredCards.reduce((s, c) => s + (c.rates?.length || 0), 0);
        const active = filteredCards.filter(c => c.status === 'ACTIVE').length;
        const uniqueVendors = new Set(filteredCards.map(c => c.vendorId)).size;
        return { total, totalRates, active, uniqueVendors };
    }, [filteredCards]);

    const statCards = [
        { label: 'Cards Found', value: stats.total, icon: 'Layers', gradient: 'from-indigo-600 to-blue-600', shadow: 'shadow-indigo-500/20' },
        { label: 'Active', value: stats.active, icon: 'CheckCircle', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
        { label: 'Vendors', value: stats.uniqueVendors, icon: 'Building', gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
        { label: 'Total Rates', value: stats.totalRates, icon: 'TrendingUp', gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    ];

    return (
        <div className="px-4 sm:px-8 py-6 sm:py-8 min-h-screen">
            <PageHeader
                title="Rate Directory"
                subtitle="Centralized repository of all active vendor rate cards for financial verification."
                icon="ShieldCheck"
                accent="indigo"
                roleLabel="Finance"
            />

            <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">
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
                            <div className={`w-11 h-11 rounded-xl bg-linear-to-r ${stat.gradient} ${stat.shadow} shadow-lg flex items-center justify-center shrink-0`}>
                                <Icon name={stat.icon} size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{stat.value}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
                        <div className="relative w-full sm:w-64">
                            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filter projects or vendors..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full pl-10 pr-8 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                            />
                            {filter && (
                                <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <Icon name="X" size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="text-center py-24">
                        <div className="inline-flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-xl animate-pulse" />
                                <span className="loading loading-spinner h-10 w-10 text-indigo-600 relative z-10"></span>
                            </div>
                            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Loading directory...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredCards.map((card, idx) => {
                            const sc = statusConfig[card.status] || statusConfig.DRAFT;
                            return (
                                <motion.div
                                    key={card.id || card._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                                    className="group"
                                >
                                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
                                        <div className="h-1.5 bg-linear-to- from-indigo-500 via-blue-500 to-cyan-500" />
                                        <div className="p-5 pb-4">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-linear-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-100/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                        <Icon name="ShieldCheck" size={18} className="text-indigo-600" />
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
                                        <div className="px-5 flex-1">
                                            <div className="bg-slate-50/80 rounded-xl border border-slate-100/80 overflow-hidden">
                                                <div className="grid grid-cols-4 gap-2 px-3.5 py-2 bg-slate-100/60 border-b border-slate-100">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Role</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Code</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Experience</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Rate</p>
                                                </div>
                                                <div className="max-h-36 overflow-y-auto">
                                                    {card.rates.map((rate, i) => (
                                                        <div key={i} className={`grid grid-cols-4 gap-2 px-3.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-white/80 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                                                            <span className="text-xs font-bold text-slate-700 truncate" title={rate.role}>{rate.role}</span>
                                                            <span className="text-xs font-bold text-slate-600 truncate">{rate.roleCode || '-'}</span>
                                                            <span className="text-xs font-medium text-slate-500 truncate">{rate.experienceRange}</span>
                                                            <span className="text-xs font-black text-indigo-600 text-right whitespace-nowrap">
                                                                ₹{Number(rate.rate).toLocaleString()}<span className="text-[9px] text-slate-400 font-bold">/{rate.unit}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-5 pt-4 mt-auto border-t border-slate-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Effective Period</p>
                                                    <p className="text-[11px] font-bold text-slate-600 leading-none">
                                                        {new Date(card.effectiveFrom).toLocaleDateString()}
                                                        {card.effectiveTo ? ` — ${new Date(card.effectiveTo).toLocaleDateString()}` : ' (No Expiry)'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {!loading && filteredCards.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-lg text-center py-20 flex flex-col items-center"
                    >
                        <div className="w-20 h-20 bg-linear-to-r from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center text-indigo-300 mb-5 border border-indigo-100/50 shadow-inner">
                            <Icon name="ShieldCheck" size={36} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">No Rate Cards Found</h3>
                        <p className="text-slate-400 text-sm mt-2 max-w-sm font-medium leading-relaxed">
                            {filter ? `No results matching "${filter}"` : 'There are currently no standard rate cards assigned to vendors.'}
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
