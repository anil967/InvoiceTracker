'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/Layout/PageHeader';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { ROLES, getNormalizedRole } from '@/constants/roles';
import { useRouter } from 'next/navigation';

export default function VendorRateCardsPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [rateCards, setRateCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && (!user || role !== ROLES.VENDOR)) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const role = getNormalizedRole(user);
        if (!authLoading && role === ROLES.VENDOR) {
            fetchRateCards();
        }
    }, [user, authLoading]);

    const fetchRateCards = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/vendor/rate-cards', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load rate cards');
            setRateCards(data.rateCards || []);
        } catch (err) {
            console.error('Error fetching rate cards:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !user || getNormalizedRole(user) !== ROLES.VENDOR) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="pb-10">
            <PageHeader
                title="My Rate Cards"
                icon="Layers"
                accent="purple"
            />

            <div className="max-w-6xl mx-auto space-y-6 px-2 sm:px-0">
                {/* Error */}
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Icon name="AlertTriangle" size={16} />
                            <span className="font-bold text-sm">{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors">
                            <Icon name="X" size={14} />
                        </button>
                    </div>
                )}

                {/* Loading */}
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
                ) : rateCards.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-lg text-center py-20 flex flex-col items-center"
                    >
                        <div className="w-20 h-20 bg-linear-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center text-purple-300 mb-5 border border-purple-100/50 shadow-inner">
                            <Icon name="Layers" size={36} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">No Rate Cards Assigned</h3>
                        <p className="text-slate-400 text-sm mt-2 max-w-sm font-medium leading-relaxed">
                            Your admin has not assigned any rate cards to your account yet. Please contact your administrator.
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {rateCards.map((card, idx) => (
                            <motion.div
                                key={card.id || card._id}
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
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                        {card.effectiveFrom ? new Date(card.effectiveFrom).toLocaleDateString() : '—'}
                                                        {card.effectiveTo ? ` → ${new Date(card.effectiveTo).toLocaleDateString()}` : ' → No expiry'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200/60 border ring-1 ring-emerald-500/20 shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                {card.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Rates Table */}
                                    <div className="px-5 flex-1 pb-5">
                                        <div className="bg-slate-50/80 rounded-xl border border-slate-100/80 overflow-hidden">
                                            {/* Table Header */}
                                            <div className="grid grid-cols-3 gap-2 px-3.5 py-2 bg-slate-100/60 border-b border-slate-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Role</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Experience</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Rate</p>
                                            </div>
                                            {/* Table Body */}
                                            <div className="max-h-48 overflow-y-auto">
                                                {(card.rates || []).map((rate, i) => (
                                                    <div key={i} className={`grid grid-cols-3 gap-2 px-3.5 py-2.5 border-b border-slate-50 last:border-0 hover:bg-white/80 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                                                        <span className="text-xs font-bold text-slate-700 truncate" title={rate.role}>{rate.role}</span>
                                                        <span className="text-xs font-medium text-slate-500 truncate">{rate.experienceRange}</span>
                                                        <span className="text-xs font-black text-purple-600 text-right whitespace-nowrap">
                                                            ₹{Number(rate.rate).toLocaleString()}<span className="text-[9px] text-slate-400 font-bold">/{rate.unit}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                                {(!card.rates || card.rates.length === 0) && (
                                                    <div className="px-3.5 py-4 text-center text-xs text-slate-400 font-medium">No rates defined</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {card.notes && (
                                        <div className="px-5 pb-5">
                                            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <span className="font-bold text-slate-600">Notes: </span>{card.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
