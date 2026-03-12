"use client";

import { useEffect, useState } from "react";
import { getAllInvoices } from "@/lib/api";
import InvoiceList from "@/components/Digitization/InvoiceList";
import Icon from "@/components/Icon";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function DigitizationPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading digitization queue...</div>}>
        <DigitizationPageContent />
      </Suspense>
    </div>
  );
}

function DigitizationPageContent() {
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'list' or 'grid'
  const [searchQuery, setSearchQuery] = useState('');

  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');

  const filterInvoices = (data, status, query) => {
    let filtered = data;
    if (status) {
      filtered = filtered.filter(inv => inv.status === status);
    }
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.vendorName?.toLowerCase().includes(q) ||
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.id?.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchedInvoices = await getAllInvoices();
        setAllInvoices(fetchedInvoices);
        setInvoices(filterInvoices(fetchedInvoices, statusFilter, searchQuery));
      } catch (e) {
        console.error("Failed to load invoices from backend", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Polling for updates
    const pollInterval = setInterval(async () => {
      try {
        const remoteInvoices = await getAllInvoices();
        setAllInvoices(remoteInvoices);
        setInvoices(filterInvoices(remoteInvoices, statusFilter, searchQuery));
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [statusFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Icon name="ScanLine" size={28} />
            </div>
            Digitization Queue
          </h1>
          <p className="text-gray-500 mt-2 ml-14 max-w-xl">
            Review, validate, and process incoming invoices. The AI pre-fills data for your verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative group">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" />
            <input
              type="text"
              placeholder="Search vendor, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border-2 border-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 w-48 sm:w-72 transition-all shadow-sm group-hover:shadow-md placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="join shadow-sm border border-white/40 rounded-lg overflow-hidden h-9">
            <button
              onClick={() => setViewMode('list')}
              className={`join-item btn btn-sm border-none hover:bg-white px-3 ${viewMode === 'list' ? 'bg-primary text-white hover:bg-primary' : 'bg-white/50 text-gray-500'}`}
            >
              <Icon name="List" size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`join-item btn btn-sm border-none hover:bg-white px-3 ${viewMode === 'grid' ? 'bg-primary text-white hover:bg-primary' : 'bg-white/50 text-gray-500'}`}
            >
              <Icon name="Grid" size={18} />
            </button>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm bg-white border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 shadow-sm gap-2 h-9 px-4 rounded-xl text-slate-600 transition-all font-bold">
              <Icon name="Filter" size={16} className={statusFilter ? "text-indigo-600" : ""} />
              {statusFilter ? statusFilter.replace('_', ' ') : 'Filter'}
            </label>
            <ul tabIndex={0} className="dropdown-content z- menu p-2 shadow-2xl bg-white rounded-2xl w-52 border border-slate-100 mt-2">
              <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Filter</p>
              </div>
              <li><button onClick={() => {
                const url = new URL(window.location);
                url.searchParams.delete('status');
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="text-xs font-bold text-slate-600 py-2.5 rounded-lg">All Records</button></li>
              <li><button onClick={() => {
                const url = new URL(window.location);
                url.searchParams.set('status', 'PAID');
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="text-xs font-bold text-emerald-600 py-2.5 rounded-lg hover:bg-emerald-50">Paid Only</button></li>
              <li><button onClick={() => {
                const url = new URL(window.location);
                url.searchParams.set('status', 'MATCH_DISCREPANCY');
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="text-xs font-bold text-orange-600 py-2.5 rounded-lg hover:bg-orange-50">Discrepancies</button></li>
              <li><button onClick={() => {
                const url = new URL(window.location);
                url.searchParams.set('status', 'REJECTED');
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="text-xs font-bold text-red-600 py-2.5 rounded-lg hover:bg-red-50">Rejected</button></li>
              <li><button onClick={() => {
                const url = new URL(window.location);
                url.searchParams.set('status', 'PENDING_APPROVAL');
                window.history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} className="text-xs font-bold text-amber-600 py-2.5 rounded-lg hover:bg-amber-50">Pending Approval</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats Summary (Mini) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 flex flex-col shadow-sm">
          <span className="text-[10px] sm:text-xs font-black uppercase opacity-70 tracking-wider">To Digitize</span>
          <span className="text-2xl font-black text-purple-700">{allInvoices.filter(i => ['RECEIVED', 'DIGITIZING', 'UPLOADED'].includes(i.status?.toUpperCase())).length}</span>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 flex flex-col shadow-sm">
          <span className="text-[10px] sm:text-xs font-black uppercase opacity-70 tracking-wider">Processing</span>
          <span className="text-2xl font-black text-blue-700">{allInvoices.filter(i => ['VERIFIED', 'MATCH_DISCREPANCY', 'VALIDATION_REQUIRED', 'ISSUE_DETECTED', 'DIGITIZED'].includes(i.status?.toUpperCase())).length}</span>
        </div>
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 flex flex-col shadow-sm">
          <span className="text-[10px] sm:text-xs font-black uppercase opacity-70 tracking-wider">Pending Approval</span>
          <span className="text-2xl font-black text-orange-700">{allInvoices.filter(i => ['PENDING_APPROVAL', 'PENDING APPROVAL'].includes(i.status?.toUpperCase())).length}</span>
        </div>
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 flex flex-col shadow-sm">
          <span className="text-[10px] sm:text-xs font-black uppercase opacity-70 tracking-wider">Completed Today</span>
          <span className="text-2xl font-black text-green-700">{allInvoices.filter(i => ['PAID', 'APPROVED', 'VERIFIED'].includes(i.status?.toUpperCase())).length}</span>
        </div>
      </div>

      {/* Main List */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-gray-500 animate-pulse">Loading invoices...</p>
          </div>
        ) : (
          <InvoiceList invoices={invoices} viewMode={viewMode} />
        )}
      </div>
    </div>
  );
}