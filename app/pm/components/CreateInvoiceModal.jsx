import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';

const TAX_TYPES = ['CGST_SGST', 'IGST', ''];

export default function CreateInvoiceModal({ isOpen, onClose, onSuccess }) {
  const auth = useAuth();
  const user = auth?.user;

  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OCR auto-fill state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [docsExtracted, setDocsExtracted] = useState(false);

  const [formData, setFormData] = useState({
    vendor: '',
    invoiceNumber: '',
    date: '',
    billingMonth: '',
    amount: 0,
    poNumber: '',
    basicAmount: 0,
    taxType: '',
    hsnCode: '',
    document: null,
    rfpFile: null,
    timesheetFile: null,
    disclaimerChecked: false
  });

  // Fetch vendors and projects when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
    }
  }, [isOpen]);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const vendorsRes = await fetch('/api/vendors');

      if (!vendorsRes.ok) {
        throw new Error('Failed to fetch vendors');
      }

      const data = await vendorsRes.json();
      setVendors(Array.isArray(data.vendors) ? data.vendors : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // OCR integration - auto-extract invoice data from PDF
  const performOCR = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) return;

    setOcrLoading(true);
    setDocsExtracted(false);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Auto-fill extracted values
          const data = result.data;
          setDocsExtracted(true);
          setFormData(prev => ({
            ...prev,
            invoiceNumber: data.invoiceNumber || prev.invoiceNumber,
            date: data.invoiceDate || prev.date,
            basicAmount: parseFloat(data.basicAmount) || prev.basicAmount,
            taxType: data.taxType || prev.taxType,
            hsnCode: data.hsnCode || prev.hsnCode,
            amount: parseFloat(data.totalAmount) || prev.amount
          }));
        }
      }
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setOcrLoading(false);
    }
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, document: file }));
      // Trigger OCR for invoice files
      await performOCR(file);
    }
  };

  const handleRFPFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, rfpFile: file }));
    }
  };

  const handleTimesheetFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, timesheetFile: file }));
    }
  };

  const handleDisclaimerToggle = () => {
    setFormData(prev => ({ ...prev, disclaimerChecked: !prev.disclaimerChecked }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.vendor || !formData.invoiceNumber ||
      !formData.date || formData.amount <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.disclaimerChecked) {
      setError('Please check the disclaimer checkbox to proceed');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formPayload = new FormData();
      formPayload.append('vendorName', formData.vendor);
      formPayload.append('invoiceNumber', formData.invoiceNumber);
      formPayload.append('date', formData.date);
      formPayload.append('amount', formData.amount.toString());
      formPayload.append('currency', 'INR'); // Fixed to INR
      formPayload.append('poNumber', formData.poNumber);
      formPayload.append('originatorRole', 'PM');
      formPayload.append('assignedPM', user?.id || '');

      // Optional fields
      if (formData.billingMonth) {
        formPayload.append('billingMonth', formData.billingMonth);
      }
      if (formData.basicAmount > 0) {
        formPayload.append('basicAmount', formData.basicAmount.toString());
      }
      if (formData.taxType) {
        formPayload.append('taxType', formData.taxType);
      }
      if (formData.hsnCode) {
        formPayload.append('hsnCode', formData.hsnCode);
      }

      // File uploads - main document and optional attachments
      if (formData.document) {
        formPayload.append('document', formData.document);
      }
      if (formData.rfpFile) {
        formPayload.append('rfpFile', formData.rfpFile);
      }
      if (formData.timesheetFile) {
        formPayload.append('timesheetFile', formData.timesheetFile);
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        body: formPayload
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to submit invoice';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      vendor: '',
      invoiceNumber: '',
      date: '',
      billingMonth: '',
      amount: 0,
      poNumber: '',
      basicAmount: 0,
      taxType: '',
      hsnCode: '',
      document: null,
      rfpFile: null,
      timesheetFile: null,
      disclaimerChecked: false
    });
    setDocsExtracted(false);
    onClose();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Icon name="PlusCircle" size={18} className="text-violet-600" />
                <Icon name="ReceiptText" size={18} className="text-violet-600" />
              </div>
              <h2 className="font-black text-slate-800 text-lg">Create New Invoice</h2>
              <button onClick={handleClose}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-10 h-10 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 font-medium">Preparing interface…</p>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700"
                >
                  <Icon name="AlertCircle" size={18} className="shrink-0 mt-0.5" />
                  <div className="text-sm font-bold leading-tight">
                    <p className="uppercase text-[10px] tracking-widest opacity-60 mb-1">System Error</p>
                    {error}
                  </div>
                </motion.div>
              )}

              {!isLoading && (
                <div className="space-y-8 pb-4">

                  {/* SECTION: Entity Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Entity Assignment</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Vendor Selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Vendor list *</label>
                        <div className="relative">
                          <Icon name="Building2" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select
                            value={formData.vendor}
                            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                          >
                            <option value="">Select Vendor…</option>
                            {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {formData.vendor && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100/50"
                      >
                        <Icon name="UserCheck" size={14} className="text-indigo-600" />
                        <p className="text-xs font-bold text-indigo-700">Submitting on behalf of {formData.vendor}</p>
                      </motion.div>
                    )}
                  </div>

                  {/* SECTION: Invoice Metadata */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-violet-500 rounded-full" />
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">General Information</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Invoice Number */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Invoice No. *</label>
                        <div className="relative">
                          <Icon name="Hash" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.invoiceNumber}
                            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                            placeholder="e.g. #7721"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Invoice Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Invoice Date *</label>
                        <div className="relative">
                          <Icon name="Calendar" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            placeholder="DD-MM-YYYY"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Billing Month */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Billing Month</label>
                        <div className="relative">
                          <Icon name="CalendarRange" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.billingMonth}
                            onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                            placeholder="e.g. February 2024"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* PO Number */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">PO Number</label>
                        <div className="relative">
                          <Icon name="FileText" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.poNumber}
                            onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                            placeholder="e.g. PO-8891"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION: Monetary */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Financial Details</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Basic Amount */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Basic Amount *</label>
                        <div className="relative">
                          <Icon name="IndianRupee" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            value={formData.basicAmount || ''}
                            onChange={(e) => setFormData({ ...formData, basicAmount: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Tax Type */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tax Type *</label>
                        <div className="relative">
                          <Icon name="Receipt" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select
                            value={formData.taxType}
                            onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none"
                          >
                            <option value="">Select Tax…</option>
                            {TAX_TYPES.map(t => <option key={t} value={t}>{t ? t.replace('_', ' + ') : 'None'}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* HSN Code */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">HSN Code</label>
                        <div className="relative">
                          <Icon name="Binary" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.hsnCode}
                            onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                            placeholder="e.g. 998314"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      {/* Total Amount */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Total Amount (₹) *</label>
                        <div className="relative">
                          <Icon name="IndianRupee" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            value={formData.amount || ''}
                            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-full bg-indigo-50/30 border border-indigo-200 rounded-xl pl-9 pr-3 py-2.5 text-md text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION: Documents */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-orange-500 rounded-full" />
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Attachments</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Main Invoice Upload */}
                      <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 transition-colors bg-slate-50/50">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                              <Icon name="FileUp" size={20} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-700">Invoice PDF *</p>
                              <p className="text-[10px] font-medium text-slate-400">Fields will auto-fill via OCR</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <AnimatePresence mode="wait">
                              {ocrLoading && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-wider"
                                >
                                  <div className="w-2 h-2 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                                  OCR Processing
                                </motion.div>
                              )}
                              {docsExtracted && !ocrLoading && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider"
                                >
                                  <Icon name="CheckCircle2" size={12} />
                                  Extracted
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <label className="h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-violet-200 active:scale-95">
                              {formData.document ? "Replace" : "Select PDF"}
                              <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                            </label>
                          </div>
                        </div>
                        {formData.document && (
                          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                            <Icon name="File" size={12} className="text-violet-500" />
                            <span className="truncate max-w-[200px]">{formData.document.name}</span>
                            <span className="opacity-40 ml-auto">{(formData.document.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* RFP Upload */}
                        <div className="p-3 rounded-xl border border-slate-200 bg-white">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">RFP Document</p>
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-bold text-slate-600">
                              {formData.rfpFile ? formData.rfpFile.name : "No file chosen"}
                            </div>
                            <label className="shrink-0 h-7 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest flex items-center justify-center cursor-pointer transition-all">
                              Upload
                              <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleRFPFileChange} />
                            </label>
                          </div>
                        </div>

                        {/* Timesheet Upload */}
                        <div className="p-3 rounded-xl border border-slate-200 bg-white">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Commercial / Timesheet</p>
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-bold text-slate-600">
                              {formData.timesheetFile ? formData.timesheetFile.name : "No file chosen"}
                            </div>
                            <label className="shrink-0 h-7 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest flex items-center justify-center cursor-pointer transition-all">
                              Upload
                              <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleTimesheetFileChange} />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION: Declaration & Submit */}
                  <div className="pt-4 border-t border-slate-100 space-y-6">
                    <div
                      onClick={handleDisclaimerToggle}
                      className={`group flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 ${formData.disclaimerChecked
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                        }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${formData.disclaimerChecked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white border-slate-300 group-hover:border-indigo-400'
                        }`}>
                        {formData.disclaimerChecked && <Icon name="Check" size={14} strokeWidth={4} />}
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-black uppercase tracking-widest ${formData.disclaimerChecked ? 'text-emerald-700' : 'text-slate-500'}`}>
                          Declaration & Confirmation
                        </p>
                        <p className={`text-xs font-medium leading-relaxed ${formData.disclaimerChecked ? 'text-emerald-600' : 'text-slate-400'}`}>
                          I have verified all the information as per agreed terms with Maruti Suzuki India Limited. The Invoice, RFP Proposal/Timesheet is strictly as per agreement. I understand that any discrepancy may lead to rejection of the invoice.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full h-14 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-95"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting Invoice...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="Send" size={18} />
                          <span>Submit to Workflow</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}