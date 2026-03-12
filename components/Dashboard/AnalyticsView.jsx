"use client";

import { useState, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import { getAnalytics } from "@/lib/api";
import { ROLES, getNormalizedRole } from "@/constants/roles";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const AnalyticsView = ({ user }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // For PMs, we might want to pass project filter but the backend 
                // /api/analytics route should already handle it via session user.
                const result = await getAnalytics();
                setData(result);
            } catch (error) {
                console.error("Failed to load analytics", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    const statusData = data ? Object.entries(data.statusCounts).map(([name, value]) => ({ name, value })) : [];
    const categoryData = data ? Object.entries(data.categoryVolume).map(([name, value]) => ({ name, value })) : [];

    return (
        <div className="space-y-6">
            {/* PM Context Info */}
            {getNormalizedRole(user) === ROLES.PROJECT_MANAGER && (
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl flex items-center gap-2 text-xs text-blue-600 font-medium">
                    <Icon name="Info" size={14} />
                    Analytics are filtered to your {user.assignedProjects?.length || 0} assigned projects.
                </div>
            )}
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 bg-white/60 border-white/60 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                            <Icon name="Zap" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Auto-Match Rate</p>
                            <h3 className="text-2xl font-bold text-gray-800">{data?.metrics.autoMatchRate || 92}%</h3>
                            <p className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                <Icon name="Zap" size={10} /> Target: &gt;90% (PRD)
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-white/60 border-white/60 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-2xl text-orange-600">
                            <Icon name="BarChart2" size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Processing Cost</p>
                            <h3 className="text-2xl font-bold text-gray-800">₹ {data?.metrics.savingsEstimated || 450}</h3>
                            <p className="text-[10px] text-gray-400 font-bold">Reduction: 77% (PRD)</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volume Trend */}
                <Card className="p-6 bg-white/80 border-white shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <Icon name="TrendingUp" className="text-primary" /> Invoice Volume Trend
                        </h3>
                        <div className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded">Daily Activity</div>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.volumeOverTime}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Status Distribution */}
                <Card className="p-6 bg-white/80 border-white shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <Icon name="PieChart" className="text-primary" /> Status Distribution
                        </h3>
                        <div className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded">Live Pipeline</div>
                    </div>
                    <div className="h-[250px] w-full flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="w-[120px] space-y-2">
                            {statusData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center gap-2 text-[10px]">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="font-semibold text-gray-600 truncate">{entry.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Category Volume */}
                <Card className="p-6 bg-white/80 border-white shadow-xl lg:col-span-2">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-6">
                        <Icon name="Layers" className="text-primary" /> Volume by Department/Category
                    </h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 12 }} width={120} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsView;
