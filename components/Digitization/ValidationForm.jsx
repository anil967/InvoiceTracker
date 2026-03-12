"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { updateInvoiceApi, getInvoiceStatus } from "@/lib/api";
import { ROLES } from "@/constants/roles";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/Icon";

const ValidationForm = ({ invoice: initialInvoice }) => {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [formData, setFormData] = useState({
    vendorName: "",
    invoiceNumber: "",
    date: "",
    dueDate: "",
    amount: "",
    category: "",
    costCenter: "",
    accountCode: "",
    poNumber: "",
    id: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confidence, setConfidence] = useState(initialInvoice?.confidence ? Math.round(initialInvoice.confidence * 100) : 85);

  useEffect(() => {
    if (invoice) {
      setFormData({
        vendorName: invoice.vendorName || "",
        invoiceNumber: invoice.invoiceNumber || invoice.id || "",
        date: invoice.invoiceDate || invoice.date || "",
        dueDate: invoice.dueDate || "",
        amount: invoice.totalAmount || invoice.amount || "0", // Default to "0" to prevent NaN
        category: invoice.category || "Uncategorized",
        costCenter: invoice.costCenter || "",
        accountCode: invoice.accountCode || "",
        poNumber: invoice.poNumber || "",
        id: invoice.id
      });
      if (invoice.confidence) {
        setConfidence(Math.round(invoice.confidence * 100));
      }
    }
  }, [invoice]);

  // Poll for updates if still digitizing
  useEffect(() => {
    if (invoice?.status === 'DIGITIZING' || invoice?.status === 'RECEIVED') {
      const interval = setInterval(async () => {
        try {
          const status = await getInvoiceStatus(invoice.id);
          if (status.status !== invoice.status) {
            clearInterval(interval);
            setInvoice(status);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [invoice?.status, invoice?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Update the invoice in backend
      const response = await updateInvoiceApi(formData.id, {
        ...formData,
        amount: parseFloat(formData.amount || 0), // Fallback to 0 during submission
        status: 'VERIFIED', // Moving to matched phase after validation
      });

      setInvoice(response.invoice);
      router.push('/digitization');
    } catch (error) {
      console.error("Submission error", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const { user } = useAuth();

  // Determine if the view should be read-only (Auditor mode)
  // detailed view from audit log or if status is finalized
  const isAuditor = ["APPROVED", "REJECTED", "PAID", "VERIFIED"].includes(invoice?.status);

  return (
    <Card className="h-full flex flex-col bg-white/40 border-white/60 backdrop-blur-xl overflow-hidden rounded-[2rem] shadow-2xl">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-8 space-y-6 sm:space-y-8">

        {/* Modern Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="p-2 bg-primary/10 rounded-xl">
                <Icon name="CheckSquare" className="text-primary" size={20} sm={24} />
              </span>
              {isAuditor ? "Review Invoice" : "Validate Data"}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {isAuditor ? "Verify extracted fields match the source." : "Correct any mismatches detected by AI."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Confidence</div>
            <div className={`text-xl sm:text-2xl font-black ${confidence > 90 ? 'text-emerald-500' : confidence > 70 ? 'text-amber-500' : 'text-rose-500'}`}>
              {confidence}%
            </div>
            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidence}%` }}
                className={`h-full ${confidence > 90 ? 'bg-emerald-500' : confidence > 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
              />
            </div>
          </div>
        </div>

        <form className="space-y-6 sm:space-y-8 pb-4">

          {/* Section 1: Vendor & Document */}
          <div className="p-6 sm:p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200/60 shadow-inner group/section transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/20">
            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-indigo-500 mb-8 px-2">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <Icon name="FileText" size={14} />
              </div>
              Document Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="form-control w-full space-y-2 sm:col-span-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest flex items-center gap-2">
                  Vendor / Merchant
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Icon name="Store" size={18} />
                  </div>
                  <input
                    type="text"
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleChange}
                    readOnly={isAuditor}
                    placeholder="Identifying..."
                    className="w-full pl-11 pr-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold text-slate-800 disabled:bg-slate-50/50 text-base"
                    required
                  />
                </div>
              </div>

              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Invoice Number</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Icon name="Hash" size={18} />
                  </div>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber || ""}
                    onChange={handleChange}
                    readOnly={isAuditor}
                    placeholder="e.g. INV-2024..."
                    className="w-full pl-11 pr-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold text-slate-800 disabled:bg-slate-50/50 text-base"
                  />
                </div>
              </div>

              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">PO Number</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Icon name="ShoppingCart" size={18} />
                  </div>
                  <input
                    type="text"
                    name="poNumber"
                    value={formData.poNumber || ""}
                    onChange={handleChange}
                    readOnly={isAuditor}
                    placeholder="e.g. PO-2026-001"
                    className="w-full pl-11 pr-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-mono font-bold text-slate-800 disabled:bg-slate-50/50 text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Financials */}
          <div className="p-6 sm:p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200/60 shadow-inner group/financial transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/20">
            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-600 mb-8 px-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <Icon name="IndianRupee" size={14} />
              </div>
              Financial Context
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Issue Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  readOnly={isAuditor}
                  className="w-full px-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-bold text-slate-800 text-base shadow-sm"
                  required
                />
              </div>

              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  readOnly={isAuditor}
                  className="w-full px-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-bold text-slate-800 text-base shadow-sm"
                />
              </div>

              <div className="form-control w-full space-y-2 sm:col-span-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Total Amount (INR)</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-emerald-600 transition-colors text-lg">₹</div>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    readOnly={isAuditor}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all font-black text-slate-900 text-xl shadow-sm"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Cost allocation */}
          <div className="p-6 sm:p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200/60 shadow-inner group/cost transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/20">
            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-amber-600 mb-8 px-2">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <Icon name="Target" size={14} />
              </div>
              Cost Allocation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="form-control w-full space-y-2 sm:col-span-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Category Selection</label>
                <div className="relative group">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    disabled={isAuditor}
                    className="w-full pl-4 pr-10 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 transition-all font-bold text-slate-800 appearance-none text-base cursor-pointer shadow-sm"
                  >
                    <option value="Uncategorized">Uncategorized</option>
                    <option value="IT Infrastructure">IT Infrastructure</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Software">Software</option>
                    <option value="Logistics">Logistics</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-amber-600">
                    <Icon name="ChevronDown" size={18} />
                  </div>
                </div>
              </div>

              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">Cost Center</label>
                <input
                  type="text"
                  name="costCenter"
                  value={formData.costCenter}
                  onChange={handleChange}
                  readOnly={isAuditor}
                  placeholder="e.g. CC-101"
                  className="w-full px-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 transition-all font-mono font-bold text-slate-800 uppercase text-sm shadow-sm"
                />
              </div>

              <div className="form-control w-full space-y-2">
                <label className="text-[11px] sm:text-xs font-black text-slate-500 ml-1 uppercase tracking-widest">GL Account Code</label>
                <input
                  type="text"
                  name="accountCode"
                  value={formData.accountCode}
                  onChange={handleChange}
                  readOnly={isAuditor}
                  placeholder="e.g. GL-5000"
                  className="w-full px-4 h-14 bg-white border-2 border-slate-100 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 transition-all font-mono font-bold text-slate-800 uppercase text-sm shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Validation Errors/Warnings with improved styling */}
          {(invoice?.validation?.errors?.length > 0 || invoice?.validation?.warnings?.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-rose-50 border border-rose-100 space-y-3 shadow-inner"
            >
              {(invoice?.validation?.errors || []).map((err, i) => (
                <div key={i} className="flex items-start gap-3 text-rose-600 text-xs font-bold">
                  <Icon name="AlertCircle" size={16} className="shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
              {(invoice?.validation?.warnings || []).map((warn, i) => (
                <div key={i} className="flex items-start gap-3 text-amber-600 text-xs font-bold">
                  <Icon name="AlertTriangle" size={16} className="shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
            </motion.div>
          )}

        </form>
      </div>

      {/* Persistent Action Footer */}
      <div className="p-6 bg-slate-50/80 border-t border-slate-200 backdrop-blur-md flex flex-col sm:flex-row gap-4">
        <Button
          variant="ghost"
          type="button"
          className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-200/50 transition-all shadow-sm"
          onClick={() => router.back()}
        >
          {isAuditor ? "Close Review" : "Cancel"}
        </Button>
        {!isAuditor && (
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            className="flex-[2] h-12 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            loading={isSaving}
            icon="CheckCircle"
          >
            Confirm & Finalize
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ValidationForm;