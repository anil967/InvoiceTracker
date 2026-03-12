"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";

const InvoiceList = ({ invoices, viewMode = 'list' }) => {
  if (!invoices || invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white/20 rounded-2xl border border-white/40 backdrop-blur-md">
        <Icon name="Inbox" size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No invoices waiting for digitization.</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const normalized = status?.toUpperCase() || "";
    switch (normalized) {
      case 'APPROVED':
      case 'PAID':
        return 'bg-success/10 text-success border-success/20';
      case 'PENDING_APPROVAL':
      case 'PENDING APPROVAL':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'ISSUE_DETECTED':
      case 'VALIDATION_REQUIRED':
      case 'REJECTED':
        return 'bg-error/10 text-error border-error/20';
      case 'PROCESSING':
        return 'bg-info/10 text-info border-info/20';
      case 'VERIFIED':
        return 'bg-success/10 text-success border-success/20';
      case 'MATCH_DISCREPANCY':
      case 'MATCH DISCREPANCY':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'DIGITIZED':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'DIGITIZING':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    const normalized = status?.toUpperCase() || "";
    switch (normalized) {
      case 'APPROVED':
      case 'PAID':
        return 'CheckCircle';
      case 'PENDING_APPROVAL':
      case 'PENDING APPROVAL':
        return 'Clock';
      case 'ISSUE_DETECTED':
      case 'VALIDATION_REQUIRED':
      case 'MATCH_DISCREPANCY':
      case 'MATCH DISCREPANCY':
        return 'AlertTriangle';
      case 'REJECTED':
        return 'XCircle';
      case 'PROCESSING':
        return 'Loader';
      case 'DIGITIZED':
      case 'VERIFIED':
        return 'Check';
      case 'DIGITIZING':
        return 'ScanLine';
      default:
        return 'FileText';
    }
  };

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="group glass-panel rounded-3xl p-6 hover:shadow-xl transition-all duration-300 border border-white/40 flex flex-col h-full bg-white/40 hover:bg-white/60"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${getStatusColor(invoice.status)} shadow-sm`}>
                <Icon name={getStatusIcon(invoice.status)} size={24} />
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(invoice.status)}`}>
                {invoice.status?.replace('_', ' ')}
              </span>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-black text-slate-800 text-lg sm:text-xl leading-tight group-hover:text-primary transition-colors truncate" title={invoice.vendorName}>
                  {invoice.vendorName || "Unknown Vendor"}
                </h3>
                <p className="text-xs font-mono font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                  ID: {invoice.id?.substring(0, 12)}...
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100/50">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Amount</span>
                  <span className="text-sm font-black text-slate-700">
                    {isNaN(Number(invoice.amount)) || !invoice.amount
                      ? '₹0.00'
                      : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(invoice.amount)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Date</span>
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
                    <Icon name="Calendar" size={12} className="text-slate-400" />
                    {invoice.date || "N/A"}
                  </span>
                </div>
              </div>
            </div>

          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/20">
        <div className="col-span-4 lg:col-span-3">Vendor / ID</div>
        <div className="col-span-3 lg:col-span-2">Date</div>
        <div className="col-span-2 lg:col-span-2 text-right">Amount</div>
        <div className="col-span-3 lg:col-span-5 text-center">Status</div>
      </div>

      <div className="space-y-3">
        {invoices.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative grid grid-cols-12 gap-4 items-center p-4 sm:p-5 rounded-3xl bg-white/40 border border-white/50 shadow-sm hover:shadow-xl hover:bg-white/60 transition-all duration-300"
          >
            <div className="col-span-8 md:col-span-4 lg:col-span-3 flex items-center gap-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${getStatusColor(invoice.status)} shadow-sm`}>
                <Icon name={getStatusIcon(invoice.status)} size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-800 text-sm sm:text-base truncate" title={invoice.vendorName}>
                  {invoice.vendorName}
                </h3>
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter truncate">
                  {invoice.id}
                </p>
              </div>
            </div>

            <div className="hidden md:block col-span-3 lg:col-span-2 text-sm font-bold text-slate-600">
              <div className="flex items-center gap-2">
                <Icon name="Calendar" size={14} className="text-slate-400" />
                {invoice.date}
              </div>
            </div>

            <div className="col-span-4 md:col-span-2 text-right font-black text-slate-700 text-sm sm:text-base">
              {isNaN(Number(invoice.amount)) || !invoice.amount
                ? '₹0.00'
                : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(invoice.amount)}
            </div>

            <div className="col-span-4 md:col-span-5 flex flex-col items-center gap-1">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${getStatusColor(invoice.status)}`}>
                {invoice.status?.replace('_', ' ')}
              </span>
            </div>

          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default InvoiceList;