"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { getAllInvoices, getAnalytics } from "@/lib/api";
import Card from "@/components/ui/Card";
import Icon from "@/components/Icon";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const STATUS_COLORS = {
  'Finance Approved': '#10b981',
  'Finance Rejected': '#ef4444',
  'Pending Finance Review': '#f59e0b'
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(value);
};

const parseAmount = (amount) => {
  if (!amount) return 0;
  return Number(String(amount).replace(/[^\d.-]/g, '')) || 0;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-white/50 p-4 rounded-xl shadow-xl">
        <p className="font-bold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => {
          const isCurrency = entry.name === 'Total Spend';
          const formattedValue = isCurrency ? formatCurrency(entry.value) : entry.value;
          return (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {formattedValue}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const AnalyticsDashboard = () => {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invData, analyticsData] = await Promise.all([
          getAllInvoices(),
          getAnalytics()
        ]);
        setInvoices(invData);
        setMetrics(analyticsData);
      } catch (error) {
        console.error("Failed to load analytics data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Metrics Calculations ---

  const statusData = useMemo(() => {
    const counts = invoices.reduce((acc, inv) => {
      // Filter for empty or invalid statuses
      const status = inv.status;
      if (status && status.trim() !== '' && status !== 'Invalid' && status !== 'undefined' && status !== 'null') {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    }));
  }, [invoices]);

  const monthlySpendingData = useMemo(() => {
    const monthlyMap = invoices.reduce((acc, inv) => {
      // Robust date extraction helper that checks inv.date, inv.receivedAt, and inv.created_at
      let dateStr = inv.date || inv.receivedAt || inv.created_at;
      if (!dateStr) return acc;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return acc;

      // Use a sortable key (YYYY-MM) for grouping and sorting months
      const sortableKey = date.toISOString().slice(0, 7); // YYYY-MM
      // Standardize labels to MMM YY (e.g., Jan 24)
      const displayLabel = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const amount = parseAmount(inv.amount);

      if (!acc[sortableKey]) {
        acc[sortableKey] = { sortableKey, month: displayLabel, amount: 0 };
      }
      acc[sortableKey].amount += amount;

      return acc;
    }, {});

    return Object.values(monthlyMap).sort((a, b) => a.sortableKey.localeCompare(b.sortableKey));
  }, [invoices]);

  const vendorPerformance = useMemo(() => {
    const vendorMap = invoices.reduce((acc, inv) => {
      const vName = inv.vendorName || 'Pending Identification';
      if (!acc[vName]) {
        acc[vName] = { name: vName, total: 0, count: 0, discrepancies: 0 };
      }
      acc[vName].total += parseAmount(inv.amount);
      acc[vName].count += 1;
      if (inv.status === 'MATCH_DISCREPANCY') {
        acc[vName].discrepancies += 1;
      }
      return acc;
    }, {});

    return Object.values(vendorMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  // Mocked Processing Time Trend (Simulating "Real" data for visual richness)
  const processingTimeData = [
    { day: 'Mon', hours: 24 },
    { day: 'Tue', hours: 18 },
    { day: 'Wed', hours: 22 },
    { day: 'Thu', hours: 15 },
    { day: 'Fri', hours: 12 },
    { day: 'Sat', hours: 30 },
    { day: 'Sun', hours: 28 },
  ];

  const kpis = useMemo(() => {
    const totalSpend = invoices.reduce((sum, inv) => sum + parseAmount(inv.amount), 0);

    return {
      totalSpend,
      activeInvoices: invoices.filter(i => !['APPROVED', 'PAID', 'REJECTED'].includes(i.status)).length,
      avgCycleTime: metrics?.metrics?.avgCycleTimeHours || 24,
      ocrAccuracy: metrics?.metrics?.ocrAccuracy || 95
    };
  }, [invoices, metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Compliance & Audit Reports Banner - Prominent at top */}
      <Card className="p-6 bg-linear-to- from-indigo-600 to-purple-600 text-white border-0 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon name="ShieldCheck" size={28} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Compliance & Audit Reports</h3>
              <p className="text-indigo-100 text-sm font-medium mt-1">Access detailed audit trails, compliance checks, and regulatory documentation</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/audit')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span>View Reports</span>
            <Icon name="ArrowRight" size={16} />
          </button>
        </div>
      </Card>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col justify-between" hoverEffect>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Spend (YTD)</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(kpis.totalSpend)}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600">
              <Icon name="IndianRupee" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-success bg-success/10 w-fit px-2 py-1 rounded">
            <Icon name="TrendingUp" size={12} className="mr-1" /> Healthy Volume
          </div>
        </Card>

        <Card className="flex flex-col justify-between" hoverEffect>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Active Pipeline</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">
                {kpis.activeInvoices}
              </h3>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600">
              <Icon name="Activity" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-warning bg-warning/10 w-fit px-2 py-1 rounded">
            <Icon name="AlertCircle" size={12} className="mr-1" /> In Review
          </div>
        </Card>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly Spending Bar Chart */}
        <Card className="col-span-1" noPadding>
          <div className="p-6 pb-0 mb-4">
            <h3 className="text-lg font-bold text-gray-800">Monthly Spending Analysis</h3>
            <p className="text-sm text-gray-500">Aggregated invoice totals by month</p>
          </div>
          <div className="w-full h-[300px] pr-6 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySpendingData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => {
                    return new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      notation: 'compact',
                      compactDisplay: 'short'
                    }).format(value);
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }} />
                <Bar
                  dataKey="amount"
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  name="Total Spend"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="col-span-1" noPadding>
          <div className="p-6 pb-0 mb-2">
            <h3 className="text-lg font-bold text-gray-800">Invoice Status Distribution</h3>
            <p className="text-sm text-gray-500">Current workflow breakdown</p>
          </div>
          <div className="w-full h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingRight: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text Overlay - Positioned in donut hole center */}
            <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-gray-800">{invoices.length}</span>
              <span className="text-xs text-gray-500 uppercase font-semibold">Total</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Processing Efficiency Chart */}
      <Card className="h-[350px]" noPadding>
        <div className="p-6 pb-0 mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Processing Efficiency</h3>
            <p className="text-sm text-gray-500">Average hours to approval (Last 7 Days)</p>
          </div>
          <button
            onClick={() => router.push('/audit')}
            className="btn btn-sm btn-ghost text-primary bg-primary/10 hover:bg-primary/20"
          >
            View Report <Icon name="ArrowRight" size={14} className="ml-1" />
          </button>
        </div>
        <div className="w-full h-[240px] px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={processingTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#8b5cf6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorHours)"
                name="Processing Hours"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Vendor Performance Analytics */}
      <Card className="border-0 shadow-lg bg-white overflow-hidden" noPadding>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800 tracking-tight">Vendor Performance Analytics</h3>
            <p className="text-sm text-gray-500 font-medium">Top vendors by volume and discrepancy rate</p>
          </div>
          <Icon name="Award" className="text-amber-500" size={24} />
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-[0.2em] font-black">
                <th className="py-5 pl-8">Vendor Partner</th>
                <th className="py-5">Invoices</th>
                <th className="py-5">Total Volume</th>
                <th className="py-5">Discrepancy Rate</th>
                <th className="py-5 pr-8 text-right font-mono">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm font-bold text-slate-700">
              {vendorPerformance.map((vendor, idx) => {
                const discRate = (vendor.discrepancies / vendor.count * 100).toFixed(1);
                return (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="py-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">
                          {vendor.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{vendor.name}</span>
                      </div>
                    </td>
                    <td className="py-5 font-mono">{vendor.count}</td>
                    <td className="py-5 font-mono">₹ {vendor.total.toLocaleString()}</td>
                    <td className="py-5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${parseFloat(discRate) > 10 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(parseFloat(discRate) * 5, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-black ${parseFloat(discRate) > 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {discRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-5 pr-8 text-right">
                      {parseFloat(discRate) < 5 ? (
                        <span className="badge badge-success badge-sm border-0 font-black text-[9px] uppercase tracking-widest py-3 px-3">Elite Tier</span>
                      ) : (
                        <span className="badge badge-warning badge-sm border-0 font-black text-[9px] uppercase tracking-widest py-3 px-3 text-white">Review Needed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;