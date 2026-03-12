"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/Layout/PageHeader";
import { motion } from "framer-motion";

export default function VendorRateCards() {
    const { user } = useAuth();
    const [rateCards, setRateCards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch('/api/vendor/rate-cards', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setRateCards(data.rateCards || []);
                }
            } catch (err) {
                console.error("Failed to fetch rate cards", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRates();
    }, []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
            <PageHeader
                title="My Rate Cards"
                subtitle="Your approved rates for projects and general services."
                icon="TrendingUp"
                accent="teal"
                roleLabel="Vendor"
            />

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="inline-flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-teal-400/20 rounded-full blur-xl animate-pulse" />
                            <span className="loading loading-spinner loading-lg text-teal-600 relative z-10"></span>
                        </div>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Loading your rates...</p>
                    </div>
                </div>
            ) : rateCards.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-lg p-12 text-center flex flex-col items-center"
                >
                    <div className="w-20 h-20 bg-linear-to-br from-teal-50 to-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-teal-300 border border-teal-100/50 shadow-inner">
                        <Icon name="FileText" size={36} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">No Rate Cards Assigned</h3>
                    <p className="text-slate-400 mt-2 text-sm max-w-sm font-medium leading-relaxed">
                        Please contact your project manager or administrator to set up your rate cards.
                    </p>
                </motion.div>
            ) : (
                <>
                    {/* Summary Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4 flex items-center gap-3.5"
                        >
                            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20 flex items-center justify-center shrink-0">
                                <Icon name="Layers" size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{rateCards.length}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rate Cards</p>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 }}
                            className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4 flex items-center gap-3.5"
                        >
                            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20 flex items-center justify-center shrink-0">
                                <Icon name="CheckCircle" size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{rateCards.filter(c => c.status === 'ACTIVE').length}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active</p>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.16 }}
                            className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-4 flex items-center gap-3.5"
                        >
                            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0">
                                <Icon name="TrendingUp" size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{rateCards.reduce((s, c) => s + (c.rates?.length || 0), 0)}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rate Lines</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {rateCards.map((card, idx) => (
                            <motion.div
                                key={card._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                                className="group"
                            >
                                <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                                    {/* Accent Strip */}
                                    <div className="h-1.5 bg-linear-to-r from-teal-500 via-emerald-500 to-green-500" />

                                    {/* Card Header */}
                                    <div className="p-5 pb-3 flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-teal-500/10 to-emerald-500/10 border border-teal-100/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Icon name="CreditCard" size={18} className="text-teal-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-black text-slate-800 text-sm tracking-tight group-hover:text-teal-700 transition-colors truncate leading-tight">
                                                    Vendor Rate Card
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                                                    Active since {new Date(card.effectiveFrom).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 ring-1 ring-emerald-500/20 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {card.status}
                                        </span>
                                    </div>

                                    {/* Rate Items */}
                                    <div className="px-5 pb-2">
                                        <div className="bg-slate-50/80 rounded-xl border border-slate-100/80 overflow-hidden">
                                            {card.rates.map((rate, rIdx) => (
                                                <div key={rIdx} className={`flex items-center justify-between p-3.5 border-b border-slate-100/60 last:border-0 hover:bg-white/60 transition-colors ${rIdx % 2 !== 0 ? 'bg-slate-50/40' : ''}`}>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100/50 flex items-center justify-center shrink-0">
                                                            <Icon name="User" size={14} className="text-teal-500" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 truncate">{rate.role}</p>
                                                            <p className="text-xs font-bold text-slate-600 leading-none">{rate.experienceRange}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <p className="text-base font-black text-slate-800 leading-none mb-1">₹{Number(rate.rate).toLocaleString()}</p>
                                                        <p className="text-[9px] text-teal-600 font-black uppercase tracking-widest leading-none">Per {rate.unit.toLowerCase()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mx-5 mb-5 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center">
                                                <Icon name="ShieldCheck" size={12} className="text-emerald-500" />
                                            </div>
                                            Verified Rate
                                        </span>
                                        <span className="text-slate-400">{card.effectiveTo ? `Expires: ${new Date(card.effectiveTo).toLocaleDateString()}` : 'No Expiry Set'}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
