'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import PageHeader from '@/components/Layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ROLES, getNormalizedRole } from '@/constants/roles';

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white/50 text-gray-900 placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed';

const ManualInvoiceEntryPage = () => {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const role = getNormalizedRole(user);

    const [formData, setFormData] = useState({
        vendorName: '',
        vendorEmail: '',
        invoiceNumber: '',
        amount: '',
        currency: 'INR',
        date: new Date().toISOString().split('T')[0],
        description: '',
        poNumber: '',
        assignedPM: '',
        document: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pms, setPms] = useState([]);
    const [pmsLoading, setPmsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'file' ? files[0] : value
        }));
    };

    useEffect(() => {
        if (!authLoading && (!user || role !== ROLES.ADMIN)) {
            router.push('/dashboard');
        }
    }, [user, authLoading, role, router]);

    useEffect(() => {
        const fetchPMs = async () => {
            setPmsLoading(true);
            try {
                const response = await fetch('/api/pms', { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                setPms(data.pms || []);
            } catch (err) {
                console.error('Error fetching PMs:', err);
            } finally {
                setPmsLoading(false);
            }
        };
        fetchPMs();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        if (!formData.vendorName || !formData.invoiceNumber || !formData.amount || !formData.date) {
            setError('Please fill in all required fields');
            setIsSubmitting(false);
            return;
        }
        if (formData.amount <= 0) {
            setError('Amount must be greater than 0');
            setIsSubmitting(false);
            return;
        }

        try {
            const submitData = new FormData();
            submitData.append('vendorName', formData.vendorName);
            submitData.append('vendorEmail', formData.vendorEmail);
            submitData.append('invoiceNumber', formData.invoiceNumber);
            submitData.append('amount', parseFloat(formData.amount).toFixed(2));
            submitData.append('currency', formData.currency);
            submitData.append('date', formData.date);
            submitData.append('description', formData.description);
            submitData.append('poNumber', formData.poNumber);
            submitData.append('status', 'VERIFIED');
            submitData.append('assignedPM', formData.assignedPM);
            if (formData.document) submitData.append('document', formData.document);

            const response = await fetch('/api/invoices', { method: 'POST', body: submitData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to submit invoice');
            }

            setSuccess('Invoice submitted successfully!');
            setFormData({
                vendorName: '',
                vendorEmail: '',
                invoiceNumber: '',
                amount: '',
                currency: 'INR',
                date: new Date().toISOString().split('T')[0],
                description: '',
                poNumber: '',
                assignedPM: '',
                document: null
            });
            setTimeout(() => router.push('/finance/dashboard'), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = 'block text-sm font-medium text-slate-700 mb-2';
    const requiredSpan = <span className="text-rose-500">*</span>;

    if (authLoading || !user || role !== ROLES.ADMIN) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 pb-10">
            <PageHeader
                title="Manual Invoice Entry"
                subtitle="Submit invoices manually for processing"
                icon="FilePlus"
                accent="indigo"
                roleLabel={role === ROLES.ADMIN ? undefined : 'Finance User'}
                actions={
                    <Link href="/finance/dashboard">
                        <button className="flex items-center justify-center gap-2 h-10 px-4 sm:px-6 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap">
                            <Icon name="ArrowLeft" size={16} /> Back to Dashboard
                        </button>
                    </Link>
                }
            />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
            >
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
                    <h2 className="text-lg font-bold text-slate-800">Invoice Details</h2>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-widest mt-0.5">Required fields marked with *</p>
                </div>

                <div className="p-6 sm:p-8">
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium"
                            >
                                <Icon name="AlertCircle" size={18} />
                                <span className="flex-1">{error}</span>
                                <button type="button" onClick={() => setError('')} className="p-1.5 rounded-lg hover:bg-rose-100">
                                    <Icon name="X" size={14} />
                                </button>
                            </motion.div>
                        )}
                        {success && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium"
                            >
                                <Icon name="CheckCircle" size={18} />
                                {success}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Vendor Name {requiredSpan}</label>
                                <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} required placeholder="Enter vendor name" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Vendor Email</label>
                                <input type="email" name="vendorEmail" value={formData.vendorEmail} onChange={handleChange} placeholder="vendor@example.com" className={inputClass} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Invoice Number {requiredSpan}</label>
                                <input type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} required placeholder="INV-00123" className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Amount {requiredSpan}</label>
                                    <input type="number" name="amount" value={formData.amount} onChange={handleChange} required min="0.01" step="0.01" placeholder="0.00" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Currency</label>
                                    <input type="text" name="currency" value={formData.currency} readOnly className={inputClass + ' bg-slate-50 cursor-default'} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Invoice Date {requiredSpan}</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>PO Number (Optional)</label>
                                <input type="text" name="poNumber" value={formData.poNumber} onChange={handleChange} placeholder="PO-001" className={inputClass} />
                            </div>
                        </div>



                        <div>
                            <label className={labelClass}>Assigned PM (Optional)</label>
                            <select name="assignedPM" value={formData.assignedPM} onChange={handleChange} disabled={pmsLoading} className={inputClass}>
                                <option value="">Select a Project Manager (Optional)</option>
                                {pms.map(pm => (
                                    <option key={pm.id} value={pm.id}>{pm.name} ({pm.email})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Enter invoice description or notes" className={inputClass + ' resize-none'} />
                        </div>

                        <div>
                            <label className={labelClass}>Invoice Document (Optional)</label>
                            <input type="file" name="document" onChange={handleChange} accept=".pdf,.doc,.docx,.csv,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden" id="document-upload" />
                            <label htmlFor="document-upload" className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                                <div className="text-center">
                                    <Icon name="Upload" size={40} className="mx-auto text-slate-400 mb-2" />
                                    <p className="text-sm font-medium text-slate-600">
                                        {formData.document ? formData.document.name : 'Click to upload or drag and drop'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">PDF, Word, Excel, CSV, JPG, PNG (MAX. 10MB)</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <Link href="/finance/dashboard">
                                <button type="button" className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                            </Link>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 h-10 px-5 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="loading loading-spinner loading-sm"></span>
                                        Submitting...
                                    </>
                                ) : (
                                    <>Submit Invoice</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default ManualInvoiceEntryPage;
