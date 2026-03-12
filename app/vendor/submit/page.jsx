'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VendorSubmitPage() {
    const [pms, setPMs] = useState([]);

    const [availableRates, setAvailableRates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const invoiceRef = useRef(null);
    const timesheetRef = useRef(null);
    const rfpRef = useRef(null);

    const [formData, setFormData] = useState({
        invoiceFile: null,
        timesheetFile: null,
        annexFile: null,
        invoiceNumber: '',
        invoiceDate: '',
        amount: '',
        basicAmount: '',
        taxType: '',
        hsnCode: '',
        billingMonth: '',
        billingMonth: '',
        assignedPM: '',
        notes: ''
    });

    const [disclaimerChecked, setDisclaimerChecked] = useState(false);

    // Line Items State
    const [lineItems, setLineItems] = useState([
        { role: '', experienceRange: '', quantity: '', unit: 'HOUR', rate: '', amount: 0 }
    ]);

    useEffect(() => {
        fetchPMs();
        fetchRateCards();
    }, []);

    const fetchPMs = async () => {
        try {
            const res = await fetch('/api/pms', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) setPMs(data.pms || []);
        } catch (err) {
            console.error('Error fetching PMs:', err);
        }
    };



    const fetchRateCards = async () => {
        try {
            const res = await fetch('/api/vendor/rate-cards', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok) {
                // Flatten rates for easy lookup
                const rates = [];
                data.rateCards?.forEach(card => {
                    card.rates?.forEach(rate => {
                        rates.push({ ...rate, cardId: card.id, cardName: card.name });
                    });
                });
                setAvailableRates(rates);
            }
        } catch (err) {
            console.error('Error fetching Rate Cards:', err);
        }
    };

    const handleFileChange = (field, e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, [field]: file });
        }
    };

    // Line Item Handlers
    const addLineItem = () => {
        setLineItems([...lineItems, { role: '', experienceRange: '', quantity: '', unit: 'HOUR', rate: '', amount: 0 }]);
    };

    const removeLineItem = (index) => {
        const newItems = [...lineItems];
        newItems.splice(index, 1);
        setLineItems(newItems);
        updateTotalAmount(newItems);
    };

    const updateLineItem = (index, field, value) => {
        const newItems = [...lineItems];
        newItems[index][field] = value;

        // Auto-fill rate if Role/Exp changes
        if (field === 'role' || field === 'experienceRange') {
            const role = field === 'role' ? value : newItems[index].role;
            const exp = field === 'experienceRange' ? value : newItems[index].experienceRange;

            if (role && exp) {
                const match = availableRates.find(r => r.role === role && r.experienceRange === exp);
                if (match) {
                    newItems[index].rate = match.rate;
                    newItems[index].unit = match.unit;
                }
            }
        }

        // Calculate Amount
        const qty = parseFloat(newItems[index].quantity) || 0;
        const rate = parseFloat(newItems[index].rate) || 0;
        newItems[index].amount = qty * rate;

        setLineItems(newItems);
        updateTotalAmount(newItems);
    };

    const updateTotalAmount = (items) => {
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        setFormData(prev => ({ ...prev, amount: total }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.invoiceFile) {
            setError('Please select an invoice file');
            return;
        }

        if (!disclaimerChecked) {
            setError('Please accept the disclaimer before submitting');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const submitData = new FormData();
            submitData.append('invoice', formData.invoiceFile);
            if (formData.timesheetFile) submitData.append('timesheet', formData.timesheetFile);
            if (formData.annexFile) submitData.append('annex', formData.annexFile);
            submitData.append('invoiceNumber', formData.invoiceNumber);
            submitData.append('invoiceDate', formData.invoiceDate);
            submitData.append('amount', formData.amount);
            submitData.append('basicAmount', formData.basicAmount);
            submitData.append('taxType', formData.taxType);
            submitData.append('hsnCode', formData.hsnCode);
            submitData.append('billingMonth', formData.billingMonth);
            submitData.append('assignedPM', formData.assignedPM);
            submitData.append('notes', formData.notes);
            submitData.append('disclaimer', disclaimerChecked ? 'true' : 'false');

            // Append Line Items
            submitData.append('lineItems', JSON.stringify(lineItems));

            const res = await fetch('/api/vendor/submit', {
                method: 'POST',
                body: submitData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(`Invoice submitted successfully! ${data.documentsAttached > 0 ? `${data.documentsAttached} document(s) attached.` : ''}`);

            // Reset form
            setFormData({
                invoiceFile: null,
                timesheetFile: null,
                annexFile: null,
                invoiceNumber: '',
                invoiceDate: '',
                amount: '',
                basicAmount: '',
                taxType: '',
                hsnCode: '',
                billingMonth: '',
                billingMonth: '',
                assignedPM: '',
                notes: ''
            });
            setDisclaimerChecked(false);
            setLineItems([{ role: '', experienceRange: '', quantity: '', unit: 'HOUR', rate: '', amount: 0 }]);
            if (invoiceRef.current) invoiceRef.current.value = '';
            if (timesheetRef.current) timesheetRef.current.value = '';
            if (rfpRef.current) rfpRef.current.value = '';
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Get unique Roles and Experience Ranges for Dropdowns
    const uniqueRoles = [...new Set(availableRates.map(r => r.role))];
    const uniqueExperiences = [...new Set(availableRates.map(r => r.experienceRange))];

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">Submit Invoice</h1>
                    <p className="text-gray-400">Upload your invoice and fill in the billing details</p>
                </motion.div>

                {/* Messages */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6"
                        >
                            {error}
                            <button onClick={() => setError(null)} className="float-right">×</button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg mb-6"
                        >
                            {success}
                            <button onClick={() => setSuccess(null)} className="float-right">×</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Submission Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/10"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* File Upload Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1 bg-purple-500/10 rounded-xl p-4 border-2 border-dashed border-purple-500/30">
                                <label className="block text-sm font-bold text-white mb-2">Invoice PDF <span className="text-red-400">*</span></label>
                                <input
                                    ref={invoiceRef}
                                    type="file"
                                    onChange={(e) => handleFileChange('invoiceFile', e)}
                                    accept=".pdf,.doc,.docx,.jpg,.png"
                                    className="w-full text-xs text-white file:mr-2 file:py-1 file:px-2 file:rounded-lg file:bg-purple-600 file:text-white"
                                />
                                {formData.invoiceFile && <p className="mt-1 text-xs text-green-400">✓ {formData.invoiceFile.name}</p>}
                            </div>
                            <div className="md:col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
                                <label className="block text-sm font-bold text-slate-300 mb-2">Timesheet (Optional)</label>
                                <input
                                    ref={timesheetRef}
                                    type="file"
                                    onChange={(e) => handleFileChange('timesheetFile', e)}
                                    accept=".pdf,.xlsx,.xls"
                                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:bg-slate-700 file:text-slate-300"
                                />
                                {formData.timesheetFile && <p className="mt-1 text-xs text-green-400">✓ {formData.timesheetFile.name}</p>}
                            </div>
                            <div className="md:col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
                                <label className="block text-sm font-bold text-slate-300 mb-2">RFP Commercial (Optional)</label>
                                <input
                                    ref={rfpRef}
                                    type="file"
                                    onChange={(e) => handleFileChange('annexFile', e)}
                                    accept=".pdf,.doc,.docx,.xlsx"
                                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:bg-slate-700 file:text-slate-300"
                                />
                                {formData.annexFile && <p className="mt-1 text-xs text-green-400">✓ {formData.annexFile.name}</p>}
                            </div>
                        </div>

                        {/* Basic Details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Invoice Number</label>
                                <input
                                    type="text"
                                    value={formData.invoiceNumber}
                                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    placeholder="e.g. INV-1001"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Invoice Date</label>
                                <input
                                    type="date"
                                    value={formData.invoiceDate}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        // Auto-populate billingMonth from invoiceDate (format: YYYY-MM)
                                        let newBillingMonth = formData.billingMonth;
                                        if (newDate) {
                                            const [year, month] = newDate.split('-');
                                            if (year && month) {
                                                newBillingMonth = `${year}-${month}`;
                                            }
                                        }
                                        setFormData({ ...formData, invoiceDate: newDate, billingMonth: newBillingMonth });
                                        setFormData({ ...formData, ...updates });
                                    }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Billing Month</label>
                                <input
                                    type="month"
                                    value={formData.billingMonth}
                                    onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {/* Tax & HSN Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Basic Amount (Before Tax)</label>
                                <input
                                    type="number"
                                    value={formData.basicAmount}
                                    onChange={(e) => setFormData({ ...formData, basicAmount: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    placeholder="e.g. 100000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Tax Type</label>
                                <select
                                    value={formData.taxType}
                                    onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="">Select Tax Type</option>
                                    <option value="CGST_SGST">CGST + SGST</option>
                                    <option value="IGST">IGST</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">HSN Code</label>
                                <input
                                    type="text"
                                    value={formData.hsnCode}
                                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    placeholder="e.g. 998314"
                                />
                            </div>
                            <div className="flex items-end">
                                <p className="text-xs text-slate-400">Total Amount (incl. Tax)</p>
                                <p className="text-lg font-bold text-white ml-2">₹{formData.amount ? Number(formData.amount).toLocaleString() : '0'}</p>
                            </div>
                        </div>

                        {/* Billing Line Items */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-white">Billing Details</h3>
                                <button type="button" onClick={addLineItem} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg">
                                    + Add Item
                                </button>
                            </div>

                            <div className="space-y-3">
                                {lineItems.map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-end bg-white/5 p-3 rounded-lg">
                                        <div className="col-span-3">
                                            <label className="block text-[10px] text-slate-400 mb-1">Role</label>
                                            <select
                                                value={item.role}
                                                onChange={(e) => updateLineItem(index, 'role', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                            >
                                                <option value="">Select Role</option>
                                                {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-[10px] text-slate-400 mb-1">Experience</label>
                                            <select
                                                value={item.experienceRange}
                                                onChange={(e) => updateLineItem(index, 'experienceRange', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                            >
                                                <option value="">Select Range</option>
                                                {uniqueExperiences.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] text-slate-400 mb-1">Qty ({item.unit})</label>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] text-slate-400 mb-1">Rate</label>
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[10px] text-slate-400 mb-1">Total</label>
                                            <p className="text-xs font-bold text-emerald-400 py-1.5">{item.amount.toLocaleString()}</p>
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            {index > 0 && (
                                                <button type="button" onClick={() => removeLineItem(index)} className="text-red-400 hover:text-red-300 p-1">
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end mt-4 pt-3 border-t border-white/10">
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">Total Amount</p>
                                    <p className="text-xl font-bold text-white">₹{formData.amount ? Number(formData.amount).toLocaleString() : '0'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Assignment */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">Assign to PM</label>
                                <select
                                    value={formData.assignedPM}
                                    onChange={(e) => setFormData({ ...formData, assignedPM: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="">Select Project Manager</option>
                                    {pms.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center">
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 w-full">
                                    <p className="text-xs font-medium text-blue-300 mb-1">🔗 Finance User</p>
                                    <p className="text-xs text-blue-200/70">Automatically assigned based on your selected PM's hierarchy. No manual selection needed.</p>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-medium text-gray-300 mb-1">Additional Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>

                        {/* Disclaimer */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={disclaimerChecked}
                                    onChange={(e) => setDisclaimerChecked(e.target.checked)}
                                    className="mt-1 w-4 h-4 accent-purple-500 rounded"
                                />
                                <span className="text-xs text-amber-200/80 leading-relaxed">
                                    I have verified all the information as per agreed terms with Maruti Suzuki India Limited.
                                    The Invoice, RFP Proposal/Timesheet is strictly as per agreement. I understand that any
                                    discrepancy may lead to rejection of the invoice.
                                </span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !formData.invoiceFile || !disclaimerChecked}
                            className="w-full py-4 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">⏳</span> Submitting...
                                </span>
                            ) : (
                                '📤 Submit Invoice'
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
